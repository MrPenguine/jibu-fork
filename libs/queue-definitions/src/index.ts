/**
 * Shared queue definitions for both backend API and worker
 */

// Queue names
export const QUEUE_NAMES = {
  DEFAULT: 'default',
  INDEXING: 'indexing',
  WORKFLOW_EXECUTION: 'workflow-execution',
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