import { Logger } from '@nestjs/common';
import OpenAI from 'openai';

/**
 * XAI (Grok) provider implementation
 */
export class XaiProvider {
  private readonly logger = new Logger(XaiProvider.name);
  private readonly openaiClient: OpenAI;
  
  constructor(private readonly apiKey: string) {
    if (!apiKey) {
      this.logger.warn('XAI API key is not configured');
    }
    
    this.openaiClient = new OpenAI({
      apiKey: apiKey || 'dummy-key',
      baseURL: 'https://api.x.ai/v1',
    });
  }
  
  /**
   * Check connection to XAI API
   */
  async checkConnection(): Promise<boolean> {
    try {
      if (!this.apiKey) {
        return false;
      }
      
      // Simple connection check - try to list models
      await this.openaiClient.models.list();
      return true;
    } catch (error) {
      this.logger.error(`Failed to check connection: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Generate streaming response from XAI API
   */
  async *generateStreamingResponse(params: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    maxTokens?: number;
  }): AsyncIterable<{ text: string; done: boolean }> {
    try {
      const { model, messages, temperature = 0.7, maxTokens = 2048 } = params;
      
      this.logger.log(`Generating streaming response with model: ${model}`);
      
      // Convert messages to the format expected by OpenAI
      const formattedMessages = messages.map(msg => {
        return {
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content
        };
      });
      
      const stream = await this.openaiClient.chat.completions.create({
        model,
        messages: formattedMessages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      });
      
      let responseText = '';
      
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          responseText += content;
          yield { text: responseText, done: false };
        }
      }
      
      yield { text: responseText, done: true };
    } catch (error) {
      this.logger.error(`Error generating response: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Generate non-streaming response from XAI API
   */
  async generateResponse(params: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    maxTokens?: number;
  }): Promise<string> {
    try {
      const { model, messages, temperature = 0.7, maxTokens = 2048 } = params;
      
      this.logger.log(`Generating response with model: ${model}`);
      
      // Convert messages to the format expected by OpenAI
      const formattedMessages = messages.map(msg => {
        return {
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content
        };
      });
      
      const response = await this.openaiClient.chat.completions.create({
        model,
        messages: formattedMessages,
        temperature,
        max_tokens: maxTokens,
      });
      
      return response.choices[0]?.message?.content || '';
    } catch (error) {
      this.logger.error(`Error generating response: ${error.message}`);
      throw error;
    }
  }
}
