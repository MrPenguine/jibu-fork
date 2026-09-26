import { Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bull';
import OpenAI from 'openai';
import { Memory } from 'mem0ai/oss';
import { PrismaService } from '../../../backend/src/core/database/prisma.service';
import {
  QUEUE_NAMES,
  JOB_NAMES,
  ExtractCallMemoryJobData,
  ExtractChatMemoryJobData,
} from '@jibu/queue-definitions';

// Same local models MemoryService uses backend-side (apps/backend/src/core/
// memory/memory.service.ts) — kept in sync manually since worker and backend
// don't share a module boundary, same reason this file already constructs
// its own EmbeddingService/VectorDbService instances elsewhere in this repo.
const OLLAMA_LLM_MODEL = 'qwen2.5:7b-instruct';
const OLLAMA_EMBED_MODEL = 'qwen3-embedding:0.6b';
const EMBEDDING_DIMS = 1024;

/**
 * Post-call analysis queue (Phase 4 of the agent-capability plan) —
 * deliberately pluggable: this is the first job type on
 * QUEUE_NAMES.POST_CALL_ANALYSIS, not the only one it's designed for. Future
 * analysis (sentiment, CRM sync, quality scoring) registers its own
 * @Process() handler on this same processor/queue without touching
 * CallConcurrencyService.release's enqueue call.
 *
 * This one: batch the call's full transcript into memory once at call end,
 * rather than per-turn — a voice call is many turns, and extracting once
 * from the complete exchange is cheaper and more coherent than firing an
 * embed/upsert after every utterance. Complements (doesn't replace)
 * MemoryService's per-turn write hook used by text/WhatsApp in
 * AgentRuntimeService — voice has no equivalent per-turn hook today, this is
 * how it gets memory at all.
 */
@Injectable()
@Processor(QUEUE_NAMES.POST_CALL_ANALYSIS)
export class PostCallAnalysisProcessor {
  private readonly logger = new Logger(PostCallAnalysisProcessor.name);
  private readonly summarizerLlm: OpenAI | null;
  private readonly summarizerModel: string;
  private readonly memoryInstances = new Map<string, Memory>();

  constructor(private readonly prisma: PrismaService) {
    // Same OpenRouter-via-env construction StrategyChunkingService already
    // uses for its own LLM summarization calls (apps/worker/src/chunking/
    // strategy-chunking.service.ts) — no shared/exported summarizer exists
    // yet, so this mirrors that convention rather than inventing a new one.
    const apiKey = process.env.OPENROUTER_API_KEY;
    this.summarizerModel = process.env.CHUNKING_LLM_MODEL || 'openai/gpt-4o-mini';
    this.summarizerLlm = apiKey ? new OpenAI({ apiKey, baseURL: 'https://openrouter.ai/api/v1' }) : null;
    if (!this.summarizerLlm) {
      this.logger.warn('OPENROUTER_API_KEY not set — Contact.metadata issue/resolved summaries will be skipped');
    }
  }

  /** Same self-hosted mem0 construction as MemoryService's backend-side
   * getMemory() — one Memory instance per workspace, backed by the same
   * Ollama LLM/embedder and Qdrant vector store, same `mem0_${workspaceId}`
   * collection so a batch call/chat write here and a per-turn write from
   * AgentRuntimeService land in the same place for the same contact. */
  private getMemory(workspaceId: string): Memory {
    let mem = this.memoryInstances.get(workspaceId);
    if (mem) return mem;
    const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    mem = new Memory({
      vectorStore: {
        provider: 'qdrant',
        config: {
          host: process.env.QDRANT_HOST || 'localhost',
          port: Number(process.env.QDRANT_PORT) || 6333,
          collectionName: `mem0_${workspaceId}`,
          embeddingModelDims: EMBEDDING_DIMS,
        },
      },
      embedder: { provider: 'ollama', config: { model: OLLAMA_EMBED_MODEL, baseURL: ollamaBaseUrl } },
      llm: { provider: 'ollama', config: { model: OLLAMA_LLM_MODEL, baseURL: ollamaBaseUrl } },
    });
    this.memoryInstances.set(workspaceId, mem);
    return mem;
  }

  @Process(JOB_NAMES.EXTRACT_CALL_MEMORY)
  async processExtractCallMemory(job: Job<ExtractCallMemoryJobData>) {
    const { callId, workspaceId, contactId } = job.data;
    try {
      const call = await this.prisma.call.findUnique({ where: { id: callId }, select: { transcript: true } });
      const text = this.transcriptToText(call?.transcript);
      if (!text) {
        this.logger.debug(`No transcript to extract memory from for call ${callId}`);
        return;
      }

      await this.getMemory(workspaceId).add(text, { userId: contactId, metadata: { source: 'call', callId } });
      this.logger.debug(`Extracted call memory for contact ${contactId} from call ${callId}`);
      await this.updateContactSummary(contactId, text);
    } catch (e) {
      this.logger.error(`Post-call memory extraction failed for call ${callId}: ${(e as Error).message}`);
    }
  }

  /**
   * Chat's counterpart to processExtractCallMemory — enqueued by
   * ChatIdleSweepService when a chat is marked terminated. This is an
   * end-of-conversation BATCH pass layered on top of the per-turn memory
   * writes chat already gets via AgentRuntimeService.fireMemoryWrite (called
   * from ChatsService.createMessage's single-brain path) — exact parity with
   * how calls work (batch-only, no per-turn equivalent exists for voice).
   * Message rows are already typed, so no shape-guessing helper is needed
   * here the way transcriptToText is for Call.transcript's untyped Json.
   */
  @Process(JOB_NAMES.EXTRACT_CHAT_MEMORY)
  async processExtractChatMemory(job: Job<ExtractChatMemoryJobData>) {
    const { chatId, workspaceId, contactId } = job.data;
    try {
      const messages = await this.prisma.message.findMany({
        where: { chatId },
        orderBy: { sequenceId: 'asc' },
        select: { role: true, content: true },
      });
      const text = messages.map((m) => `${m.role}: ${m.content}`).join('\n');
      if (!text.trim()) {
        this.logger.debug(`No messages to extract memory from for chat ${chatId}`);
        return;
      }

      await this.getMemory(workspaceId).add(text, { userId: contactId, metadata: { source: 'chat', chatId } });
      this.logger.debug(`Extracted chat memory for contact ${contactId} from chat ${chatId}`);
      await this.updateContactSummary(contactId, text);
    } catch (e) {
      this.logger.error(`Post-chat memory extraction failed for chat ${chatId}: ${(e as Error).message}`);
    }
  }

  /** Call.transcript is untyped Json — accept a few plausible shapes rather
   * than assuming one specific transcript-writer's format, since that
   * feature isn't confirmed wired everywhere yet. */
  private transcriptToText(transcript: unknown): string {
    if (!transcript) return '';
    if (typeof transcript === 'string') return transcript;
    if (Array.isArray(transcript)) {
      return transcript
        .map((t: any) => (typeof t === 'string' ? t : `${t?.role || 'user'}: ${t?.content || t?.text || ''}`))
        .filter(Boolean)
        .join('\n');
    }
    return '';
  }

  /**
   * Writes {lastIssue, resolved} onto Contact.metadata after a call/chat
   * analysis pass — independently try/caught so a summarization failure
   * never affects the memory-vector write that already succeeded above.
   * Merge pattern mirrors ToolExecutorService.checkConfirmationGate's
   * existing read-modify-write spread on Chat.metadata.
   */
  private async updateContactSummary(contactId: string, text: string): Promise<void> {
    const summary = await this.summarizeContactIssue(text);
    if (!summary) return;
    try {
      const contact = await this.prisma.contact.findUnique({ where: { id: contactId }, select: { metadata: true } });
      const existing = (contact?.metadata as Record<string, unknown>) || {};
      await this.prisma.contact.update({
        where: { id: contactId },
        data: {
          metadata: {
            ...existing,
            lastIssue: summary.lastIssue,
            resolved: summary.resolved,
            updatedAt: new Date().toISOString(),
          },
        },
      });
    } catch (e) {
      this.logger.warn(`Failed to write Contact.metadata summary for ${contactId}: ${(e as Error).message}`);
    }
  }

  private async summarizeContactIssue(text: string): Promise<{ lastIssue: string; resolved: boolean } | null> {
    if (!this.summarizerLlm) return null;
    try {
      const resp = await this.summarizerLlm.chat.completions.create({
        model: this.summarizerModel,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'Summarize the customer\'s issue from this conversation in 15 words or fewer, and say whether it was resolved by the end. Respond ONLY with JSON: {"lastIssue": string, "resolved": boolean}.',
          },
          { role: 'user', content: text.slice(0, 24000) },
        ],
      });
      const raw = resp.choices?.[0]?.message?.content?.trim();
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return typeof parsed.lastIssue === 'string'
        ? { lastIssue: parsed.lastIssue, resolved: Boolean(parsed.resolved) }
        : null;
    } catch (e) {
      this.logger.warn(`Contact issue summarization failed: ${(e as Error).message}`);
      return null;
    }
  }
}
