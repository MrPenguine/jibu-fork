/**
 * Types for n8n API request/response payloads
 */

/**
 * Base n8n workflow type
 */
export interface N8nWorkflow {
  id?: string;
  name: string;
  active: boolean;
  nodes: N8nNode[];
  connections: {
    main: N8nConnection[];
  };
  settings?: {
    executionOrder?: string;
    saveExecutionProgress?: boolean;
    saveManualExecutions?: boolean;
    executionTimeout?: number;
  };
  tags?: string[];
  pinData?: Record<string, any>;
  versionId?: string;
  meta?: Record<string, any>;
}

/**
 * n8n node type
 */
export interface N8nNode {
  id: string;
  name: string;
  type: string;
  typeVersion?: number;
  position: [number, number];
  parameters?: Record<string, any>;
  credentials?: Record<string, any>;
  disabled?: boolean;
  notesInFlow?: boolean;
  notes?: string;
  continueOnFail?: boolean;
  alwaysOutputData?: boolean;
  retryOnFail?: boolean;
  maxTries?: number;
  waitBetweenTries?: number;
  executeOnce?: boolean;
}

/**
 * n8n connection type
 */
export interface N8nConnection {
  node: string;
  type: string;
  index: number;
  destination?: {
    node: string;
    type: string;
    index: number;
  };
}

/**
 * n8n webhook configuration
 */
export interface N8nWebhook {
  httpMethod: string;
  path: string;
  webhookId?: string;
  responseMode?: string;
  responseData?: string[];
}

/**
 * n8n execution type
 */
export interface N8nExecution {
  id?: string;
  workflowId: string;
  finished?: boolean;
  mode: string;
  startedAt: string;
  stoppedAt?: string;
  status?: string;
  data?: Record<string, any>;
}

/**
 * n8n credential type
 */
export interface N8nCredential {
  id?: string;
  name: string;
  type: string;
  data: Record<string, any>;
  nodesAccess: {
    nodeType: string;
    date: string;
  }[];
  ownedBy?: string;
  sharedWith?: {
    id: string;
    role: string;
  }[];
}

/**
 * n8n tag type
 */
export interface N8nTag {
  id?: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * n8n variable type
 */
export interface N8nVariable {
  id?: string;
  key: string;
  value: string;
  type?: string;
}

/**
 * Common n8n response format
 */
export interface N8nResponse<T> {
  data: T;
  meta?: Record<string, any>;
}

/**
 * Webhook node types with their default configurations
 */
export enum N8nWebhookType {
  STANDARD = 'n8n-nodes-base.chatTrigger', // Keep for compatibility, but prefer CHAT_TRIGGER
  CHAT_TRIGGER = 'n8n-nodes-base.chatTrigger',
  RESPONSE = 'n8n-nodes-base.respondToWebhook',
}

/**
 * Common AI node types
 */
export enum N8nAiNodeType {
  LANGCHAIN_AGENT = '@n8n/n8n-nodes-langchain.agent',
  GEMINI_CHAT = '@n8n/n8n-nodes-langchain.lmChatGoogleGemini',
  MEMORY_BUFFER = '@n8n/n8n-nodes-langchain.memoryBufferWindow',
}

/**
 * Integration node types
 */
export enum N8nIntegrationNodeType {
  HTTP_REQUEST = 'n8n-nodes-base.httpRequest',
  SEND_SMS = 'n8n-nodes-base.vonageSms',
  SEND_EMAIL = 'n8n-nodes-base.emailSend',
}

/**
 * Types of node connections in n8n
 */
export enum N8nConnectionType {
  MAIN = 'main',
  AI_LANGUAGE_MODEL = 'ai_languageModel',
  AI_MEMORY = 'ai_memory',
}

/**
 * Standard node position configuration
 */
export interface NodePosition {
  x: number;
  y: number;
}

/**
 * Template for webhook-based workflow
 */
export interface WebhookWorkflowTemplate {
  name: string;
  webhookPath: string;
  webhookMethod?: string;
  agentPrompt?: string;
  memoryEnabled?: boolean;
  contextWindowLength?: number;
  integrationNodes?: {
    type: N8nIntegrationNodeType;
    parameters: Record<string, any>;
    position: NodePosition;
  }[];
}
