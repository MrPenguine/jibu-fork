/**
 * Shared queue definitions for both backend API and worker
 */

// Queue names
export const QUEUE_NAMES = {
  DEFAULT: 'default',
  INDEXING: 'indexing',
  WORKFLOW_EXECUTION: 'workflow-execution',
  WORKFLOW_PUBLISH: 'workflow-publish',
  WEBHOOK_DELIVERY: 'webhook-delivery',
};

// Job names
export const JOB_NAMES = {
  // Default queue jobs
  DEFAULT_JOB: 'default-job',
  EMAIL_JOB: 'email-job',
  
  // Indexing queue jobs
  INDEX_FILE_SOURCE: 'index-file-source',
  DEINDEX_SOURCE: 'deindex-source',
  
  // Workflow execution queue jobs
  EXECUTE_WORKFLOW: 'execute-workflow',
  CANCEL_WORKFLOW: 'cancel-workflow',
  CHECK_WORKFLOW_STATUS: 'check-workflow-status',

  // Workflow publish queue jobs
  PUBLISH_WORKFLOW: 'publish-workflow',

  // Webhook delivery queue jobs
  DELIVER_WEBHOOK: 'deliver-webhook',
};

// Job interfaces
export interface DefaultJobData {
  [key: string]: any;
}

export interface EmailJobData {
  recipient: string;
  subject: string;
  body: string;
}

export interface IndexFileSourceJobData {
  knowledgeBaseSourceId: string;
  organizationId: string;
}

export interface DeindexSourceJobData {
  knowledgeBaseSourceId: string;
  organizationId: string;
  sourceType: string;
  sourcePointer: string;
  knowledgeBaseId: string;
}

export interface WorkflowExecutionJobData {
  workflowId: string;
  organizationId: string;
  userId?: string;
  input?: Record<string, any>;
  executionId?: string;
  callbackUrl?: string;
}

export interface WorkflowStatusJobData {
  executionId: string;
  workflowId: string;
  organizationId: string;
}

export interface CancelWorkflowJobData {
  executionId: string;
  workflowId: string;
  organizationId: string;
  reason?: string;
}

// Workflow publish job payload
export interface PublishWorkflowJobData {
  workflowId: string;
  workspaceId: string;
  n8nWorkflowDbId?: string;
  activate?: boolean;
  force?: boolean;
}

// ============================================================================
// WEBHOOK PAYLOAD STRUCTURE - Phase 3 Implementation
// Complete conversation context for self-contained n8n workflow execution
// ============================================================================

/**
 * Priority levels for webhook delivery
 */
export enum WebhookPriority {
  VOICE_EVENTS = 10,      // Call lifecycle events (incoming, answered, hangup)
  VOICE_MESSAGES = 5,     // User voice input messages
  CHAT_MESSAGES = 1,      // Non-voice chat messages
}

/**
 * Voice metadata for quality control and optimization
 */
export interface VoiceMetadata {
  confidence: number;      // Speech recognition confidence (0.0-1.0)
  language: string;        // Detected language code (e.g., 'en-US', 'es-ES')
  duration: number;        // Audio duration in milliseconds
}

/**
 * Call lifecycle event types
 */
export type CallEventType = 'incoming' | 'answered' | 'dtmf' | 'hangup';

/**
 * Call event data for phone call lifecycle
 */
export interface CallEventData {
  type: CallEventType;     // Specific call lifecycle event type
  from?: string;           // Caller phone number
  to?: string;             // Recipient phone number
  dtmfDigits?: string;     // Phone keypad digits pressed during call
}

/**
 * Connection context for active voice calls
 */
export interface ConnectionContextData {
  startTime: number;       // Call start time (Unix timestamp)
  callSid: string;         // Unique call identifier from telephony provider
}

/**
 * Conversation history message
 */
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;       // Unix timestamp
}

/**
 * RAG search result
 */
export interface RagResult {
  source: string;          // Source document identifier
  content: string;         // Relevant content snippet
}

/**
 * RAG context with placeholder support
 * NOTE: Currently returns empty placeholders, will be implemented in future phase
 */
export interface RagContext {
  results: RagResult[];    // RAG search results (empty placeholder for now)
  query: string;           // Original RAG query (empty placeholder for now)
  fallbackMessage: string; // Fallback message when RAG unavailable
}

/**
 * AI context that makes voice agents effective
 */
export interface AiContext {
  systemPrompt: string;              // Agent's personality and instructions
  systemMessage: string;             // Current conversation context
  conversationHistory: ConversationMessage[];  // Last 5-10 message exchanges
  ragContext: RagContext;            // RAG context (placeholder only)
}

/**
 * Complete webhook payload structure
 * Self-contained with all context needed for n8n workflow execution
 */
export interface WebhookPayload {
  // Core event structure (universal)
  eventType: 'message' | 'call';     // Distinguishes between messages and call events
  sessionId: string;                 // Unique conversation session identifier
  workflowId: string;                // Which agent workflow handles this event
  timestamp: number;                 // Event occurrence time (Unix timestamp)
  connectionContext?: ConnectionContextData;  // Active call state (for voice)
  
  // Message-specific data (when eventType === 'message')
  text?: string;                     // User input text
  isVoice?: boolean;                 // Whether from speech recognition
  voiceMetadata?: VoiceMetadata;     // Voice quality metrics
  
  // Call-specific data (when eventType === 'call')
  callEvent?: CallEventData;         // Call lifecycle event details
  
  // AI context (for all events)
  aiContext?: AiContext;             // Complete conversation context
}

/**
 * Webhook delivery job data
 * Internal queue structure for webhook delivery
 */
export interface WebhookDeliveryJobData {
  workflowId: string;
  sessionId: string;
  payload: WebhookPayload;           // Complete structured payload
  isVoice: boolean;
  connectionId?: string;             // Optional connection ID for tracking
  priority?: number;                 // Priority level (higher = more urgent)
}

/**
 * Connection context for active voice calls
 * Used for connection state management in Redis
 */
export interface ConnectionContext {
  workflowId: string;
  sessionId: string;
  callSid?: string;
  startTime: number;
  lastHeartbeat: number;
  isActive: boolean;
  metadata?: Record<string, any>;
}