import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Memory } from 'mem0ai/oss';

// Same local models already proven elsewhere in this codebase — qwen2.5:7b-instruct
// was selected this session as the best-performing local tool-calling model for the
// agent brain itself; qwen3-embedding:0.6b (1024 dims) already backs KB search.
const OLLAMA_LLM_MODEL = 'qwen2.5:7b-instruct';
const OLLAMA_EMBED_MODEL = 'qwen3-embedding:0.6b';
const EMBEDDING_DIMS = 1024;

/**
 * Cross-session recall for a resolved Contact (see ContactService — voice +
 * WhatsApp callers, persona-testing personas, never anonymous sessions).
 *
 * Backed by the real mem0ai OSS SDK (`mem0ai/oss`), self-hosted against
 * infrastructure this app already runs — Ollama for both the extraction LLM
 * and the embedder, Qdrant for the vector store — no new external
 * dependency or paid API. This replaces an earlier hand-rolled version that
 * only embedded and stored raw exchange text; mem0 does real LLM-based fact
 * extraction/dedup on write and ranked retrieval on read.
 *
 * One Qdrant collection per workspace (`mem0_${workspaceId}`, deliberately a
 * different name than the old `agent_memories_${workspaceId}` collections —
 * mem0 manages its own point schema internally, and mixing that with the
 * old hand-rolled payload shape in the same collection would be fragile;
 * the old collections were test-era data, nothing worth migrating).
 * Collection-per-workspace mirrors the existing per-KB pattern
 * (`kb_${knowledgeBaseId}`) — makes cross-tenant leakage structurally
 * impossible rather than relying on a query-time filter alone; mem0's own
 * `userId` (→ Contact.id) scoping is a second layer inside that already-
 * isolated collection, not the only one.
 */
@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);
  private readonly instances = new Map<string, Memory>();

  constructor(private readonly config: ConfigService) {}

  private ollamaBaseUrl(): string {
    return this.config.get<string>('OLLAMA_BASE_URL') || 'http://localhost:11434';
  }

  private getMemory(workspaceId: string): Memory {
    let mem = this.instances.get(workspaceId);
    if (mem) return mem;
    mem = new Memory({
      vectorStore: {
        provider: 'qdrant',
        config: {
          host: this.config.get<string>('QDRANT_HOST') || 'localhost',
          port: Number(this.config.get('QDRANT_PORT')) || 6333,
          collectionName: `mem0_${workspaceId}`,
          embeddingModelDims: EMBEDDING_DIMS,
        },
      },
      embedder: {
        provider: 'ollama',
        config: { model: OLLAMA_EMBED_MODEL, baseURL: this.ollamaBaseUrl() },
      },
      llm: {
        provider: 'ollama',
        config: { model: OLLAMA_LLM_MODEL, baseURL: this.ollamaBaseUrl() },
      },
    });
    this.instances.set(workspaceId, mem);
    return mem;
  }

  /** Read a contact's relevant memory for the current input — ranked search
   * over mem0's already-extracted facts, not a raw-text similarity match. */
  async read(workspaceId: string, contactId: string, queryText: string, limit = 5): Promise<string[]> {
    try {
      const result = await this.getMemory(workspaceId).search(queryText, {
        topK: limit,
        filters: { user_id: contactId },
      });
      return (result.results || []).map((r) => r.memory).filter(Boolean);
    } catch (e) {
      this.logger.warn(`Memory read failed for contact ${contactId}: ${(e as Error).message}`);
      return [];
    }
  }

  /** List all memories for a contact, newest first — for the Contacts page's
   * "what does mem0 know about this contact" viewer. */
  async listAll(
    workspaceId: string,
    contactId: string,
    limit = 50,
  ): Promise<Array<{ text: string; createdAt: string; source: 'call' | 'chat' | 'turn' }>> {
    try {
      const result = await this.getMemory(workspaceId).getAll({ topK: limit, filters: { user_id: contactId } });
      return (result.results || [])
        .map((r) => ({
          text: r.memory,
          createdAt: r.createdAt || '',
          source: ((r.metadata?.source as string) || 'turn') as 'call' | 'chat' | 'turn',
        }))
        .filter((m) => m.text)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    } catch (e) {
      this.logger.warn(`Memory listAll failed for contact ${contactId}: ${(e as Error).message}`);
      return [];
    }
  }

  /** Write a completed exchange into memory — mem0 runs its own LLM
   * extraction pass on `text` rather than storing it verbatim. Always call
   * fire-and-forget (`.catch(...)`, never awaited) — this must never add
   * latency to the turn the caller/chatter already received a response for.
   * `metadata.source` (e.g. 'call' | 'chat') is optional and only affects
   * how listAll() labels the resulting memory; omit it for per-turn writes,
   * which default to 'turn'. */
  async write(workspaceId: string, contactId: string, text: string, metadata?: Record<string, unknown>): Promise<void> {
    if (!text.trim()) return;
    try {
      await this.getMemory(workspaceId).add(text, { userId: contactId, metadata });
    } catch (e) {
      this.logger.warn(`Memory write failed for contact ${contactId}: ${(e as Error).message}`);
    }
  }
}
