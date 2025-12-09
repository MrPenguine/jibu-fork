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
export interface AiContext {
    systemPrompt: string;
    systemMessage: string;
    conversationHistory: ConversationMessage[];
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
export type MessagePayload = CommonPayloadFields & {
    eventType: 'message';
} & MessagePayloadFields;
export type CallPayload = CommonPayloadFields & {
    eventType: 'call';
} & CallPayloadFields;
export type WebhookPayload = MessagePayload | CallPayload;
export default WebhookPayload;
