import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { GoogleGenerativeAI, FunctionDeclaration, Tool as GeminiTool } from '@google/generative-ai';
import { PrismaService } from '../../core/database/prisma.service';
import { RagService } from './providers/langchain/rag.service';
import { ToolExecutorService } from './tool-executor.service';

export type AgentChannel = 'chat' | 'whatsapp' | 'voice';

export interface RunTurnParams {
  agentId: string;
  channel: AgentChannel;
  sessionId: string;
  input: string;
  workspaceId?: string;
  /** Explicit KB override; otherwise resolved from agent links + metadata. */
  knowledgeBaseId?: string;
  /** Persist user + assistant messages to Chat/Message. Off by default so legacy callers that persist themselves don't double-write. */
  persist?: boolean;
  /** User id to attribute tool executions to (optional for voice/whatsapp). */
  executedById?: string | null;
}

export interface ToolCallRecord {
  toolId: string;
  name: string;
  arguments: Record<string, unknown>;
  result: unknown;
}

export interface RunTurnResult {
  output: string;
  toolCalls?: ToolCallRecord[];
  meta: Record<string, unknown>;
}

interface ResolvedProvider {
  provider: 'xai' | 'google' | 'mistral' | 'openrouter' | 'ollama' | '';
  modelName: string;
  modelUsed: string;
}

interface ChatMsg {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[];
}

interface FunctionDef {
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
}

const MAX_TOOL_ITERATIONS = 5;

/**
 * The single, channel-agnostic agent brain.
 *
 * Every channel (web chat, WhatsApp, voice) calls `runTurn` / `streamTurn` with
 * the same contract; only the transport differs. The brain lives here (Option B):
 * n8n is never the conversational brain — tools are executed via
 * `ToolExecutorService` only when the LLM decides to call one.
 */
@Injectable()
export class AgentRuntimeService {
  private readonly logger = new Logger(AgentRuntimeService.name);
  private readonly googleApiKey: string;
  private readonly xaiApiKey: string;
  private readonly mistralApiKey: string;
  private readonly openrouterApiKey: string;
  private readonly xaiClient: OpenAI;
  private readonly mistralClient: OpenAI;
  private readonly openrouterClient: OpenAI;
  private readonly ollamaClient: OpenAI;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly ragService: RagService,
    private readonly toolExecutor: ToolExecutorService,
  ) {
    this.googleApiKey = this.configService.get<string>('GOOGLE_API_KEY') || this.configService.get<string>('GEMINI_API_KEY');
    this.xaiApiKey = this.configService.get<string>('XAI_API_KEY');
    this.mistralApiKey = this.configService.get<string>('MISTRAL_API_KEY');
    this.openrouterApiKey = this.configService.get<string>('OPENROUTER_API_KEY');
    this.xaiClient = new OpenAI({ apiKey: this.xaiApiKey || 'dummy-key', baseURL: 'https://api.x.ai/v1' });
    this.mistralClient = new OpenAI({ apiKey: this.mistralApiKey || 'dummy-key', baseURL: 'https://api.mistral.ai/v1' });
    this.openrouterClient = new OpenAI({
      apiKey: this.openrouterApiKey || 'dummy-key',
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': this.configService.get<string>('NEXT_PUBLIC_BASE_URL') || 'http://localhost:3000',
        'X-Title': 'Jibu',
      },
    });
    this.ollamaClient = new OpenAI({
      apiKey: 'ollama',
      baseURL: this.configService.get<string>('OLLAMA_BASE_URL') || 'http://localhost:11434/v1',
    });
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async runTurn(params: RunTurnParams): Promise<RunTurnResult> {
    const ctx = await this.prepareTurn(params);

    if (ctx.provider === 'google') {
      const result = await this.runGeminiLoop(ctx);
      await this.maybePersist(params, ctx.workspaceId, result.output);
      return result;
    }

    const result = await this.runOpenAiLoop(ctx);
    await this.maybePersist(params, ctx.workspaceId, result.output);
    return result;
  }

  /**
   * Streaming variant for web chat. Yields incremental deltas (matching the
   * existing SSE contract). When the agent has tools, falls back to the
   * (non-streaming) tool loop and emits the final answer as a single delta.
   */
  async *streamTurn(params: RunTurnParams): AsyncIterable<{ output: string; meta?: Record<string, unknown> }> {
    const ctx = await this.prepareTurn(params);

    if (ctx.functionDefs.length > 0 || ctx.provider === 'mistral') {
      // Tool-calling streaming is complex; run the full loop and emit once.
      const result =
        ctx.provider === 'google' ? await this.runGeminiLoop(ctx) : await this.runOpenAiLoop(ctx);
      yield { output: result.output, meta: { ...result.meta, type: 'chunk' } };
      yield { output: '', meta: { type: 'final', modelUsed: ctx.modelUsed } };
      await this.maybePersist(params, ctx.workspaceId, result.output);
      return;
    }

    let full = '';
    if (ctx.provider === 'google') {
      const genAI = new GoogleGenerativeAI(this.googleApiKey);
      const model = genAI.getGenerativeModel({
        model: ctx.modelName,
        systemInstruction: ctx.context
          ? `${ctx.systemPrompt}\n\nContext information:\n${ctx.context}`
          : ctx.systemPrompt,
        generationConfig: { temperature: ctx.temperature, maxOutputTokens: ctx.maxTokens },
      });
      const contents = ctx.messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
      const streamRes = await model.generateContentStream({ contents });
      for await (const chunk of streamRes.stream) {
        const text = chunk.text();
        if (text) {
          full += text;
          yield { output: text, meta: { type: 'chunk', modelUsed: ctx.modelUsed } };
        }
      }
    } else {
      // mistral + tool paths are handled above; here provider is xai, openrouter, or ollama.
      const client =
        ctx.provider === 'openrouter'
          ? this.openrouterClient
          : ctx.provider === 'ollama'
            ? this.ollamaClient
            : this.xaiClient;
      const stream = await client.chat.completions.create({
        model: ctx.modelName,
        messages: ctx.messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        temperature: ctx.temperature,
        max_tokens: ctx.maxTokens,
        stream: true,
      });
      for await (const part of stream) {
        const delta = part.choices[0]?.delta?.content || '';
        if (delta) {
          full += delta;
          yield { output: delta, meta: { type: 'chunk', modelUsed: ctx.modelUsed } };
        }
      }
    }

    yield { output: '', meta: { type: 'final', modelUsed: ctx.modelUsed } };
    await this.maybePersist(params, ctx.workspaceId, full);
  }

  // ---------------------------------------------------------------------------
  // Turn preparation
  // ---------------------------------------------------------------------------

  private async prepareTurn(params: RunTurnParams) {
    const { agentId, sessionId, input } = params;
    if (!agentId) throw new Error('agentId is required');

    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new Error(`Agent with ID ${agentId} not found`);

    const workspaceId = params.workspaceId || agent.workspaceId;
    const metadata = (agent.metadata as Record<string, unknown>) || {};
    const modelConfig = (metadata.model as Record<string, unknown>) || {};
    const { provider, modelName, modelUsed } = this.determineProvider(modelConfig);
    if (!provider) throw new Error('No valid API key configured for any provider');

    const systemPrompt =
      (metadata.systemPrompt as string) || agent.voicemailMessage || 'You are a helpful assistant.';

    // RAG context across all linked knowledge bases (+ overrides).
    const kbIds = await this.resolveKnowledgeBaseIds(agentId, metadata, params.knowledgeBaseId);
    const context = await this.buildRagContext(kbIds, input);

    // History (last ~10 messages) keyed by sessionId == chatId.
    const history = await this.getChatHistory(sessionId);

    // Tools -> function definitions.
    const { functionDefs, nameToToolId } = await this.loadTools(agentId);

    const messages: ChatMsg[] = [{ role: 'system', content: systemPrompt }];
    if (context) messages.push({ role: 'system', content: `Context information:\n${context}` });
    for (const m of history) {
      messages.push({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content });
    }
    messages.push({ role: 'user', content: input });

    return {
      agent,
      workspaceId,
      provider,
      modelName,
      modelUsed,
      systemPrompt,
      context,
      messages,
      functionDefs,
      nameToToolId,
      temperature: (modelConfig.temperature as number) ?? 0.7,
      maxTokens: (modelConfig.maxTokens as number) ?? 2048,
      executedById: params.executedById ?? null,
    };
  }

  // ---------------------------------------------------------------------------
  // OpenAI-compatible loop (xAI / Mistral)
  // ---------------------------------------------------------------------------

  private async runOpenAiLoop(ctx: Awaited<ReturnType<typeof this.prepareTurn>>): Promise<RunTurnResult> {
    const client =
      ctx.provider === 'mistral'
        ? this.mistralClient
        : ctx.provider === 'openrouter'
          ? this.openrouterClient
          : ctx.provider === 'ollama'
            ? this.ollamaClient
            : this.xaiClient;
    const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = ctx.functionDefs.map((f) => ({
      type: 'function',
      function: { name: f.name, description: f.description, parameters: f.parameters as Record<string, unknown> },
    }));
    const messages = ctx.messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[];
    const toolCalls: ToolCallRecord[] = [];

    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const completion = await client.chat.completions.create({
        model: ctx.modelName,
        messages,
        temperature: ctx.temperature,
        max_tokens: ctx.maxTokens,
        ...(tools.length ? { tools } : {}),
      });

      const choice = completion.choices[0].message;
      if (!choice.tool_calls || choice.tool_calls.length === 0) {
        return {
          output: choice.content || '',
          toolCalls: toolCalls.length ? toolCalls : undefined,
          meta: { modelUsed: ctx.modelUsed, iterations: i + 1 },
        };
      }

      messages.push(choice as OpenAI.Chat.Completions.ChatCompletionMessageParam);
      for (const tc of choice.tool_calls) {
        const fn = tc.function;
        const toolId = ctx.nameToToolId[fn.name];
        let args: Record<string, unknown> = {};
        try {
          args = fn.arguments ? JSON.parse(fn.arguments) : {};
        } catch {
          /* leave args empty on parse error */
        }
        const result = toolId
          ? await this.toolExecutor.executeTool(toolId, args, {
              workspaceId: ctx.workspaceId,
              executedById: ctx.executedById,
            })
          : { status: 'failed', error: `Unknown tool ${fn.name}` };
        toolCalls.push({ toolId: toolId || '', name: fn.name, arguments: args, result });
        messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
      }
    }

    return {
      output: 'I was unable to complete the request within the allowed tool steps.',
      toolCalls,
      meta: { modelUsed: ctx.modelUsed, iterations: MAX_TOOL_ITERATIONS, capped: true },
    };
  }

  // ---------------------------------------------------------------------------
  // Gemini loop
  // ---------------------------------------------------------------------------

  private async runGeminiLoop(ctx: Awaited<ReturnType<typeof this.prepareTurn>>): Promise<RunTurnResult> {
    const genAI = new GoogleGenerativeAI(this.googleApiKey);
    const geminiTools: GeminiTool[] | undefined = ctx.functionDefs.length
      ? [{ functionDeclarations: ctx.functionDefs as unknown as FunctionDeclaration[] }]
      : undefined;

    const model = genAI.getGenerativeModel({
      model: ctx.modelName,
      systemInstruction: ctx.context
        ? `${ctx.systemPrompt}\n\nContext information:\n${ctx.context}`
        : ctx.systemPrompt,
      generationConfig: { temperature: ctx.temperature, maxOutputTokens: ctx.maxTokens },
      ...(geminiTools ? { tools: geminiTools } : {}),
    });

    // Build chat history (exclude system + context messages).
    const rawHistory = ctx.messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(0, -1)
      .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));

    // The Google Generative AI SDK requires the first message in history to be from 'user'.
    // Strip out any leading 'model' messages to prevent validation crashes.
    let startIndex = 0;
    while (startIndex < rawHistory.length && rawHistory[startIndex].role === 'model') {
      startIndex++;
    }
    const historyContents = rawHistory.slice(startIndex);

    const chat = model.startChat({ history: historyContents });

    const toolCalls: ToolCallRecord[] = [];
    let message: Array<{ text?: string; functionResponse?: unknown }> | string = ctx.messages[ctx.messages.length - 1].content;

    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const result = await chat.sendMessage(message as string);
      const response = result.response;
      const calls = response.functionCalls?.() || [];

      if (!calls.length) {
        return {
          output: response.text() || '',
          toolCalls: toolCalls.length ? toolCalls : undefined,
          meta: { modelUsed: ctx.modelUsed, iterations: i + 1 },
        };
      }

      const functionResponses: Array<{ functionResponse: { name: string; response: object } }> = [];
      for (const call of calls) {
        const toolId = ctx.nameToToolId[call.name];
        const args = (call.args as Record<string, unknown>) || {};
        const execResult = toolId
          ? await this.toolExecutor.executeTool(toolId, args, {
              workspaceId: ctx.workspaceId,
              executedById: ctx.executedById,
            })
          : { status: 'failed', error: `Unknown tool ${call.name}` };
        toolCalls.push({ toolId: toolId || '', name: call.name, arguments: args, result: execResult });
        functionResponses.push({
          functionResponse: { name: call.name, response: { result: execResult } as object },
        });
      }
      message = functionResponses as unknown as string;
    }

    return {
      output: 'I was unable to complete the request within the allowed tool steps.',
      toolCalls,
      meta: { modelUsed: ctx.modelUsed, iterations: MAX_TOOL_ITERATIONS, capped: true },
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers (reused / adapted from LangchainAgentService)
  // ---------------------------------------------------------------------------

  private determineProvider(modelConfig: Record<string, unknown>): ResolvedProvider {
    const configProvider = String(modelConfig?.provider || '').toLowerCase();
    const configModel = String(modelConfig?.model || '').toLowerCase();
    let provider: ResolvedProvider['provider'] = '';
    let modelName = '';

    const strip = (m: string) => m.replace(/^.*?\//, '');

    // OpenRouter is an OpenAI-compatible gateway. Its model ids are namespaced
    // (e.g. "openai/gpt-4o", "anthropic/claude-3.5-sonnet") so we keep the full
    // id rather than stripping the provider prefix.
    if (/openrouter|open-router/.test(configProvider) && this.openrouterApiKey) {
      const modelName = configModel || 'openai/gpt-4o-mini';
      return { provider: 'openrouter', modelName, modelUsed: modelName };
    }

    if (/ollama/.test(configProvider)) {
      const modelName = configModel || 'llama3';
      return { provider: 'ollama', modelName, modelUsed: `ollama/${modelName}` };
    }

    if (/x-ai|xai|grok/.test(configProvider) && this.xaiApiKey) {
      provider = 'xai';
      modelName = strip(configModel);
      if (!modelName.includes('grok')) modelName = 'grok-3-latest';
    } else if (/google|gemini/.test(configProvider) && this.googleApiKey) {
      provider = 'google';
      modelName = strip(configModel);
      if (!modelName.includes('gemini')) modelName = 'gemini-1.5-pro';
    } else if (configProvider.includes('mistral') && this.mistralApiKey) {
      provider = 'mistral';
      modelName = strip(configModel);
      if (!modelName.includes('mistral')) modelName = 'mistral-large-latest';
    } else if (configModel.includes('grok') && this.xaiApiKey) {
      provider = 'xai';
      modelName = strip(configModel);
    } else if (configModel.includes('gemini') && this.googleApiKey) {
      provider = 'google';
      modelName = strip(configModel);
    } else if (configModel.includes('mistral') && this.mistralApiKey) {
      provider = 'mistral';
      modelName = strip(configModel);
    } else if (this.xaiApiKey) {
      provider = 'xai';
      modelName = 'grok-3-latest';
    } else if (this.googleApiKey) {
      provider = 'google';
      modelName = 'gemini-1.5-pro';
    } else if (this.mistralApiKey) {
      provider = 'mistral';
      modelName = 'mistral-large-latest';
    }

    const prefix = provider === 'xai' ? 'x-ai' : provider;
    const modelUsed = provider ? `${prefix}/${modelName}` : '';
    return { provider, modelName, modelUsed };
  }

  private async resolveKnowledgeBaseIds(
    agentId: string,
    metadata: Record<string, unknown>,
    override?: string,
  ): Promise<string[]> {
    const ids = new Set<string>();
    if (override) ids.add(override);
    if (metadata.knowledgeBaseId) ids.add(String(metadata.knowledgeBaseId));
    try {
      const links = await this.prisma.agentKnowledgeBase.findMany({
        where: { agentId },
        select: { knowledgeBaseId: true },
      });
      for (const l of links) ids.add(l.knowledgeBaseId);
    } catch (e) {
      this.logger.warn(`Could not load agent KB links: ${(e as Error).message}`);
    }
    return [...ids];
  }

  private async buildRagContext(kbIds: string[], query: string): Promise<string> {
    if (!kbIds.length || !query) return '';
    const chunks: string[] = [];
    for (const kbId of kbIds) {
      try {
        // Read the KB's persisted embedding model + retrieval config so the
        // query embeds with the SAME model used at index time, and honors topK.
        const kb = await this.prisma.knowledgeBase.findUnique({ where: { id: kbId } });
        const embeddingModel = (kb as any)?.embeddingModel || null;
        const retrievalConfig = ((kb as any)?.retrievalConfig as Record<string, unknown>) || {};
        const topK =
          typeof retrievalConfig.topK === 'number' && retrievalConfig.topK > 0
            ? Math.min(Math.round(retrievalConfig.topK as number), 50)
            : 5;

        const processed = this.ragService.preprocessQuery(query);
        const results = await this.ragService.searchKnowledgeBase(kbId, processed, topK, embeddingModel);
        for (const r of results) {
          const text = (r as { payload?: { text?: string } })?.payload?.text;
          if (text) chunks.push(text);
        }
      } catch (e) {
        this.logger.warn(`KB search failed for ${kbId}: ${(e as Error).message}`);
      }
    }
    return chunks.length ? `Here is some relevant information:\n\n${chunks.join('\n\n')}` : '';
  }

  private async getChatHistory(chatId: string): Promise<Array<{ role: string; content: string }>> {
    if (!chatId) return [];
    try {
      const messages = await this.prisma.message.findMany({
        where: { chatId },
        orderBy: { sequenceId: 'asc' },
        take: 20,
      });
      return messages.slice(-10).map((m) => ({ role: m.role, content: m.content }));
    } catch (e) {
      this.logger.error(`Error getting chat history: ${(e as Error).message}`);
      return [];
    }
  }

  private async loadTools(
    agentId: string,
  ): Promise<{ functionDefs: FunctionDef[]; nameToToolId: Record<string, string> }> {
    const functionDefs: FunctionDef[] = [];
    const nameToToolId: Record<string, string> = {};
    try {
      const links = await this.prisma.agentTool.findMany({
        where: { agentId },
        include: { tool: true },
      });
      for (const link of links) {
        const tool = link.tool;
        if (!tool?.enabled) continue;
        const fn = (tool.function as Record<string, unknown>) || {};
        const name = (fn.name as string) || tool.name.replace(/[^a-zA-Z0-9_]/g, '_');
        const parameters = (fn.parameters as Record<string, unknown>) || { type: 'object', properties: {} };
        functionDefs.push({ name, description: (fn.description as string) || tool.description || undefined, parameters });
        nameToToolId[name] = tool.id;
      }
    } catch (e) {
      this.logger.warn(`Could not load agent tools: ${(e as Error).message}`);
    }
    return { functionDefs, nameToToolId };
  }

  private async maybePersist(params: RunTurnParams, workspaceId: string, output: string): Promise<void> {
    if (!params.persist || !params.sessionId) return;
    try {
      const chat = await this.prisma.chat.findFirst({ where: { id: params.sessionId } });
      if (!chat) {
        this.logger.warn(`Cannot persist turn: chat ${params.sessionId} not found`);
        return;
      }
      const existing = await this.prisma.message.findMany({
        where: { chatId: chat.id },
        orderBy: { sequenceId: 'desc' },
        take: 1,
      });
      let seq = existing.length ? existing[0].sequenceId + 1 : 0;
      await this.prisma.message.create({
        data: { chatId: chat.id, content: params.input, role: 'user', sequenceId: seq++, type: 'text' },
      });
      await this.prisma.message.create({
        data: { chatId: chat.id, content: output, role: 'assistant', sequenceId: seq, type: 'text' },
      });
    } catch (e) {
      this.logger.error(`Error persisting turn: ${(e as Error).message}`);
    }
  }
}
