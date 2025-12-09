export * from './webhook-payload';
export declare const QUEUE_NAMES: {
    DEFAULT: string;
    INDEXING: string;
    WORKFLOW_EXECUTION: string;
    WORKFLOW_PUBLISH: string;
    WEBHOOK_DELIVERY: string;
};
export declare const JOB_NAMES: {
    DEFAULT_JOB: string;
    EMAIL_JOB: string;
    INDEX_FILE_SOURCE: string;
    DEINDEX_SOURCE: string;
    EXECUTE_WORKFLOW: string;
    CANCEL_WORKFLOW: string;
    CHECK_WORKFLOW_STATUS: string;
    PUBLISH_WORKFLOW: string;
    DELIVER_WEBHOOK: string;
};
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
export interface PublishWorkflowJobData {
    workflowId: string;
    workspaceId: string;
    n8nWorkflowDbId?: string;
    activate?: boolean;
    force?: boolean;
}
export declare enum WebhookPriority {
    VOICE_EVENTS = 10,
    VOICE_MESSAGES = 5,
    CHAT_MESSAGES = 1
}
export interface ConnectionContext {
    workflowId: string;
    sessionId: string;
    callSid?: string;
    startTime: number;
    lastHeartbeat: number;
    isActive: boolean;
    metadata?: Record<string, any>;
}
