import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ILlmService, LlmAgentConfig, LlmResponse } from '../../interfaces/llm.interface';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class GeminiLlmService implements ILlmService {
  private readonly logger = new Logger(GeminiLlmService.name);
  private readonly googleApiKey: string;
  private readonly genAI: GoogleGenerativeAI;
  
  constructor(private configService: ConfigService) {
    this.googleApiKey = this.configService.get<string>('GOOGLE_API_KEY', '');
    if (!this.googleApiKey) {
      this.logger.warn('GOOGLE_API_KEY is not configured. Gemini models will not work.');
    } else {
      this.genAI = new GoogleGenerativeAI(this.googleApiKey);
    }
    this.logger.log('Initialized GeminiLlmService');
  }
  
  async checkConnection(): Promise<boolean> {
    try {
      if (!this.googleApiKey) {
        return false;
      }
      
      // Simple connection check - try to get model info
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      return !!model;
    } catch (error) {
      this.logger.error(`Failed to check connection: ${error.message}`);
      return false;
    }
  }
  
  async generateResponse(prompt: string, config?: LlmAgentConfig): Promise<LlmResponse> {
    try {
      if (!this.googleApiKey) {
        throw new Error('GOOGLE_API_KEY is not configured');
      }
      
      const modelName = config?.model || 'gemini-1.5-flash';
      const temperature = config?.temperature || 0.7;
      const maxTokens = config?.maxTokens || 2048;
      
      this.logger.log(`Generating response with model: ${modelName}, temperature: ${temperature}, maxTokens: ${maxTokens}`);
      
      const model = this.genAI.getGenerativeModel({ 
        model: modelName,
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
        }
      });
      
      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      // For simplicity, we're not calculating token usage here
      // In a production environment, you would want to track this
      return {
        text,
        modelUsed: modelName,
        tokenUsage: {
          promptTokens: 0, // Placeholder
          completionTokens: 0, // Placeholder
          totalTokens: 0 // Placeholder
        }
      };
    } catch (error) {
      this.logger.error(`Error generating response: ${error.message}`);
      throw error;
    }
  }
}
