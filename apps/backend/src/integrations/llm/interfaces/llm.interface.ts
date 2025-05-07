export const ILlmService = Symbol('ILlmService');

export interface LlmAgentConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LlmResponse {
  text: string;
  modelUsed: string;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ILlmService {
  /**
   * Verifies connection to the LLM service
   */
  checkConnection(): Promise<boolean>;

  /**
   * Generates a response from the LLM
   */
  generateResponse(
    prompt: string,
    config?: LlmAgentConfig,
  ): Promise<LlmResponse>;
} 