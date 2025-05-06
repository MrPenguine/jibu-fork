/**
 * Shared queue definitions for both backend API and worker
 */

// Queue names
export const QUEUE_NAMES = {
  DEFAULT: 'default',
  INDEXING: 'indexing',
};

// Job names
export const JOB_NAMES = {
  // Default queue jobs
  DEFAULT_JOB: 'default-job',
  EMAIL_JOB: 'email-job',
  
  // Indexing queue jobs
  INDEX_FILE_SOURCE: 'index-file-source',
  DEINDEX_SOURCE: 'deindex-source',
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
} 