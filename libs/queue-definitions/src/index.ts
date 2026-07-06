/**
 * Shared queue definitions for both backend API and worker
 */

import type { WebhookPayload } from './webhook-payload';
export * from './webhook-payload';

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
  REEMBED_CHUNK: 'reembed-chunk',
  
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

export interface ChunkConfig {
  strategies?: string[];   // e.g. ['clean_html','summarize','smart','headers','faq']
  chunkSize?: number;
  chunkOverlap?: number;
}

export interface IndexFileSourceJobData {
  knowledgeBaseSourceId: string;
  workspaceId: string;
  chunkConfig?: ChunkConfig;
}

export interface DeindexSourceJobData {
  knowledgeBaseSourceId: string;
  workspaceId: string;
  sourceType: string;
  sourcePointer: string;
  knowledgeBaseId: string;
}

export interface ReembedChunkJobData {
  knowledgeBaseId: string;
  sourceId: string;
  chunkMetadataId: string;
  vectorId: string;
  text: string;
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

/**
 * Priority levels for webhook delivery
 */
export enum WebhookPriority {
  VOICE_EVENTS = 10,      // Call lifecycle events (incoming, answered, hangup)
  VOICE_MESSAGES = 5,     // User voice input messages
  CHAT_MESSAGES = 1,      // Non-voice chat messages
}

/**
 * Webhook delivery job data
 * WEBHOOK_DELIVERY now uses raw WebhookPayload — no wrapper
 * Job data for this queue is exactly WebhookPayload
 */

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