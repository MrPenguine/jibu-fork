// SINGLE SOURCE OF TRUTH – WebhookPayload used by both chat and voice

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  speaker?: string;
  messageId?: string;
}

export interface RagResult {
  content: string;
  source: string;
  score?: number;
}

export interface RagContext {
  query: string;
  results: RagResult[];
  fallbackMessage: string;
}

// This context is sent to the LLM on every message/call — keep it lean and consistent
export interface AiContext {
  systemPrompt: string;
  systemMessage: string;
  // Maximum 10 most recent messages — older ones are trimmed before sending
  conversationHistory: ConversationMessage[];
  // Injected by RAG service — contains search results for the current user input
  ragContext: RagContext;
}

export interface VoiceMetadata {
  confidence: number;
  language: string;
  duration: number;
}

export type CallEventType = 'incoming' | 'answered' | 'dtmf' | 'hangup' | 'speech' | 'recording';

export interface CallEventData {
  type: CallEventType;
  from?: string;
  to?: string;
  dtmfDigits?: string;
}

export interface ConnectionContextData {
  startTime: number;
  callSid: string;
}

export interface CommonPayloadFields {
  eventType: 'message' | 'call';
  sessionId: string;
  workflowId: string;
  timestamp: number;
  connectionContext?: ConnectionContextData;
  aiContext?: AiContext;
  // Optional bag for custom data — accessible in n8n as {{$json.extra}}
  extra?: Record<string, any>;
}

export interface MessagePayloadFields {
  text: string;
  isVoice?: boolean;
  voiceMetadata?: VoiceMetadata;
}

export interface CallPayloadFields {
  callEvent: CallEventData;
  from?: string;
  to?: string;
  dtmfDigits?: string;
}

/**
 * This is a discriminated union — TypeScript narrows type based on eventType
 */
export type MessagePayload = CommonPayloadFields & { eventType: 'message' } & MessagePayloadFields;

export type CallPayload = CommonPayloadFields & { eventType: 'call' } & CallPayloadFields;

export type WebhookPayload = MessagePayload | CallPayload;

export default WebhookPayload;
