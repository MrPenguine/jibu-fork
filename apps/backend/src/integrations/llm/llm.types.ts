export { LlmAgentConfig, LlmResponse } from './interfaces/llm.interface';

export interface LlmResult {
  textResponse: string;
  stopReason?: string;
} 