export const IAgentService = Symbol('IAgentService');

export interface AgentConfig {
  assistantId?: string;
  clientId?: string;
  knowledgeBaseId?: string;
  stream?: boolean;
}

export interface AgentRequest {
  input: string;
  inputType?: 'chat' | 'text';
  outputType?: 'chat' | 'text';
  sessionId?: string;
  config: AgentConfig;
}

export interface AgentResponse {
  output: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

export interface IAgentService {
  /**
   * Verifies connection to the Agent service
   */
  checkConnection(): Promise<boolean>;

  /**
   * Processes a request through the agent
   */
  processRequest(request: AgentRequest): Promise<AgentResponse>;

  /**
   * Processes a streaming request through the agent
   */
  processStreamingRequest(request: AgentRequest): AsyncIterable<AgentResponse>;
}
