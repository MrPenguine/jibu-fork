// Shared service that builds consistent WebhookPayload for chat and voice — enforces DB-backed history trimming and agent-specific RAG-enriched prompts

import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  WebhookPayload,
  MessagePayload,
  CallPayload,
  AiContext,
  ConversationMessage,
  RagContext,
  VoiceMetadata,
  CallEventData,
  ConnectionContextData,
} from '@jibu/queue-definitions';

export interface RagContextProvider {
  getRagContext(query: string, knowledgeBaseId?: string): Promise<RagContext>;
}

export const RAG_CONTEXT_PROVIDER_TOKEN = 'RAG_CONTEXT_PROVIDER_TOKEN';

export interface ChatsService {
  getConversationHistoryForSession(
    sessionId: string,
    workflowId?: string,
  ): Promise<ConversationMessage[]>;
}

export interface AgentPrompts {
  systemPrompt: string;
  systemMessage: string;
}

export interface AgentPromptsProvider {
  getAgentPrompts(workflowId: string): Promise<AgentPrompts>;
}

export const AGENT_PROMPTS_PROVIDER_TOKEN = 'AGENT_PROMPTS_PROVIDER_TOKEN';

export interface BuildMessagePayloadParams {
  workflowId: string;
  sessionId: string;
  text: string;
  isVoice?: boolean;
  voiceMetadata?: VoiceMetadata;
  aiContextOverride?: Partial<AiContext>;
  connectionContext?: ConnectionContextData;
  extra?: Record<string, any>;
}

export interface BuildCallPayloadParams {
  workflowId: string;
  sessionId: string;
  callEvent: CallEventData;
  from?: string;
  to?: string;
  dtmfDigits?: string;
  transcribedText?: string;
  aiContextOverride?: Partial<AiContext>;
  connectionContext?: ConnectionContextData;
  extra?: Record<string, any>;
}

@Injectable()
export default class PayloadBuilderService {
  constructor(
    @Inject(RAG_CONTEXT_PROVIDER_TOKEN)
    private readonly ragContextService: RagContextProvider,
    @Inject('ChatsService')
    private readonly chatsService: ChatsService,
    @Inject(AGENT_PROMPTS_PROVIDER_TOKEN)
    private readonly agentPromptsProvider: AgentPromptsProvider,
    private readonly configService: ConfigService,
  ) {}

  private trimHistoryToTen(messages: ConversationMessage[] | undefined): ConversationMessage[] {
    if (!messages || messages.length === 0) {
      return [];
    }

    if (messages.length <= 10) {
      return messages;
    }

    return messages.slice(-10);
  }
  // Fetches full chat history from database via ChatsService — shared by both message and voice paths
  private async loadConversationHistory(
    sessionId: string,
    workflowId: string,
  ): Promise<ConversationMessage[]> {
    try {
      if (!sessionId) {
        return [];
      }

      const history = await this.chatsService.getConversationHistoryForSession(
        sessionId,
        workflowId,
      );
      return Array.isArray(history) ? history : [];
    } catch {
      return [];
    }
  }

  // Builds RAG context for LLM — used by both chat and voice paths
  private async buildRagContext(userText: string): Promise<RagContext> {
    const query = userText || '';

    // Delegate to RagContextService which returns a RagContext structure
    const baseContext = await this.ragContextService.getRagContext(query);

    const results = baseContext?.results ?? [];

    if (results.length > 0) {
      return {
        query,
        results,
        // When we have RAG hits, no fallback is needed
        fallbackMessage: '',
      };
    }

    const fallbackMessage =
      baseContext?.fallbackMessage ||
      this.configService.get<string>('DEFAULT_RAG_FALLBACK_MESSAGE') ||
      "I couldn’t find relevant information in the knowledge base.";

    return {
      query,
      results,
      fallbackMessage,
    };
  }

  private async loadAgentPrompts(
    workflowId: string,
    overrides?: Partial<AiContext>,
  ): Promise<AgentPrompts> {
    const defaultPrompt =
      this.configService.get<string>('DEFAULT_SYSTEM_PROMPT') ||
      'You are a helpful AI assistant.';
    const defaultMessage =
      this.configService.get<string>('DEFAULT_SYSTEM_MESSAGE') ||
      'How can I help you today?';

    let providerPrompts: AgentPrompts | null = null;

    if (workflowId) {
      try {
        providerPrompts = await this.agentPromptsProvider.getAgentPrompts(workflowId);
      } catch {
        providerPrompts = null;
      }
    }

    const providerSystemPrompt = providerPrompts?.systemPrompt?.trim() || '';
    const providerSystemMessage = providerPrompts?.systemMessage?.trim() || '';

    return {
      systemPrompt:
        overrides?.systemPrompt ||
        providerSystemPrompt ||
        defaultPrompt,
      systemMessage:
        overrides?.systemMessage ||
        providerSystemMessage ||
        defaultMessage,
    };
  }

  private async buildAiContext(
    workflowId: string,
    sessionId: string,
    text: string,
    overrides?: Partial<AiContext>,
  ): Promise<AiContext> {
    const baseHistory =
      overrides?.conversationHistory && overrides.conversationHistory.length > 0
        ? overrides.conversationHistory
        : [];

    const conversationHistory = this.trimHistoryToTen(baseHistory);
    const ragContext = overrides?.ragContext ?? {
      query: '',
      results: [],
      fallbackMessage:
        this.configService.get<string>('DEFAULT_RAG_FALLBACK_MESSAGE') ||
        "I couldn’t find relevant information in the knowledge base.",
    };
    const { systemPrompt, systemMessage } = await this.loadAgentPrompts(workflowId, overrides);

    return {
      systemPrompt,
      systemMessage,
      conversationHistory,
      ragContext,
    };
  }

  async buildMessagePayload(params: BuildMessagePayloadParams): Promise<MessagePayload> {
    const {
      workflowId,
      sessionId,
      text,
      isVoice = false,
      voiceMetadata,
      aiContextOverride,
      connectionContext,
      extra,
    } = params;
    const fullHistory = await this.loadConversationHistory(sessionId, workflowId);
    const conversationHistory = this.trimHistoryToTen(fullHistory);
    // Always limit to 10 most recent messages — prevents token overflow

    const ragContext = await this.buildRagContext(text);
    // RAG context injected — identical logic for chat and voice

    const aiContext = await this.buildAiContext(workflowId, sessionId, text, {
      ...aiContextOverride,
      conversationHistory,
      ragContext,
    });

    const payload: MessagePayload = {
      eventType: 'message',
      workflowId,
      sessionId,
      timestamp: Date.now(),
      text,
      isVoice,
      aiContext,
      extra,
    };

    if (voiceMetadata) {
      payload.voiceMetadata = voiceMetadata;
    }

    if (connectionContext) {
      payload.connectionContext = connectionContext;
    }

    return payload;
  }

  async buildCallPayload(params: BuildCallPayloadParams): Promise<CallPayload> {
    const {
      workflowId,
      sessionId,
      callEvent,
      from,
      to,
      dtmfDigits,
      transcribedText,
      aiContextOverride,
      connectionContext,
      extra,
    } = params;

    const textForRag = transcribedText?.trim() || '';
    const fullHistory = await this.loadConversationHistory(sessionId, workflowId);
    const conversationHistory = this.trimHistoryToTen(fullHistory);
    // Always limit to 10 most recent messages — prevents token overflow

    const ragContext = await this.buildRagContext(textForRag);
    // RAG context injected — identical logic for chat and voice

    const aiContext = await this.buildAiContext(workflowId, sessionId, textForRag, {
      ...aiContextOverride,
      conversationHistory,
      ragContext,
    });

    const mergedCallEvent: CallEventData = {
      ...callEvent,
      from: callEvent.from ?? from,
      to: callEvent.to ?? to,
      dtmfDigits: callEvent.dtmfDigits ?? dtmfDigits,
    };

    const payload: CallPayload = {
      eventType: 'call',
      workflowId,
      sessionId,
      timestamp: Date.now(),
      callEvent: mergedCallEvent,
      from,
      to,
      dtmfDigits,
      aiContext,
      extra,
    };

    if (connectionContext) {
      payload.connectionContext = connectionContext;
    }

    return payload;
  }
}
