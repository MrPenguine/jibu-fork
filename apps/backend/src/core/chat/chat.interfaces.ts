/**
 * Chat system interfaces and types
 * Phase 4: Redis-based conversation storage with TTL management
 */

/**
 * Chat message with role, content, and metadata
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  isVoice?: boolean;
  confidence?: number;
  language?: string;
  duration?: number;
}

/**
 * RAG context structure (placeholder implementation)
 */
export interface RagContext {
  results: Array<{
    source: string;
    content: string;
  }>;
  query: string;
  fallbackMessage: string;
}

/**
 * Complete chat context for AI workflows
 */
export interface ChatContext {
  systemPrompt: string;
  systemMessage: string;
  conversationHistory: ChatMessage[];
  ragContext: RagContext;
}

/**
 * Conversation participant information
 */
export interface ConversationParticipant {
  userId?: string;
  role: 'user' | 'agent';
  joinedAt: number;
}

/**
 * Conversation status
 */
export type ConversationStatus = 'active' | 'inactive' | 'ended';

/**
 * Complete conversation metadata
 */
export interface ChatConversation {
  sessionId: string;
  workflowId: string;
  workspaceId: string;
  participants: ConversationParticipant[];
  status: ConversationStatus;
  createdAt: number;
  lastActivity: number;
  context?: Partial<ChatContext>;
  metadata?: Record<string, any>;
}

/**
 * Redis key patterns for chat data
 */
export const CHAT_REDIS_KEYS = {
  CONVERSATION: (sessionId: string) => `chat:conversation:${sessionId}`,
  MESSAGES: (sessionId: string) => `chat:messages:${sessionId}`,
  ACTIVE_SESSIONS: 'chat:active:sessions',
  USER_SESSIONS: (userId: string) => `chat:user:sessions:${userId}`,
} as const;

/**
 * TTL configuration for chat data
 */
export const CHAT_TTL_CONFIG = {
  CONVERSATION_TTL: 86400, // 24 hours in seconds
  MESSAGE_TTL: 86400, // 24 hours in seconds
  INACTIVE_TIMEOUT: 3600000, // 1 hour in milliseconds
  CLEANUP_INTERVAL: 1800000, // 30 minutes in milliseconds
} as const;

/**
 * Options for retrieving conversation history
 */
export interface GetHistoryOptions {
  limit?: number;
  offset?: number;
  includeSystem?: boolean;
}

/**
 * Options for creating a new conversation
 */
export interface CreateConversationOptions {
  workflowId: string;
  workspaceId: string;
  userId?: string;
  initialContext?: Partial<ChatContext>;
  metadata?: Record<string, any>;
}

/**
 * Options for adding a message to conversation
 */
export interface AddMessageOptions {
  role: 'user' | 'assistant' | 'system';
  content: string;
  isVoice?: boolean;
  voiceMetadata?: {
    confidence: number;
    language: string;
    duration: number;
  };
}
