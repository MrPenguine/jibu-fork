import { Inject, Injectable, Logger } from '@nestjs/common';
import { ILlmService, LlmAgentConfig, LlmResponse } from './interfaces/llm.interface';

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(
    @Inject(ILlmService) private readonly llmProvider: ILlmService,
  ) {}

  async checkConnection(): Promise<boolean> {
    return this.llmProvider.checkConnection();
  }

  async generate(prompt: string, config?: LlmAgentConfig): Promise<string> {
    try {
      const response = await this.llmProvider.generateResponse(prompt, config);
      return response.text;
    } catch (error) {
      this.logger.error(`Error generating response: ${error.message}`);
      throw error;
    }
  }

  async transcribe(audioBuffer: Buffer): Promise<string> {
    throw new Error('LLM service cannot transcribe audio. Use SttService instead.');
  }
} 