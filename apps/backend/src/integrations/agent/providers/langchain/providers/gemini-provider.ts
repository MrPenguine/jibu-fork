import { Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Google Gemini provider implementation
 */
export class GeminiProvider {
  private readonly logger = new Logger(GeminiProvider.name);
  private readonly genAI: GoogleGenerativeAI;
  
  constructor(private readonly apiKey: string) {
    if (!apiKey) {
      this.logger.warn('Google API key is not configured');
    } else {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
  }
  
  /**
   * Check connection to Google Gemini API
   */
  async checkConnection(): Promise<boolean> {
    try {
      if (!this.apiKey) {
        return false;
      }
      
      // Simple connection check - try to get a model
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
      await model.generateContent('Hello');
      return true;
    } catch (error) {
      this.logger.error(`Failed to check connection: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Generate streaming response from Google Gemini API
   */
  async *generateStreamingResponse(params: {
    model: string;
    messages: Array<{ role: string; parts: Array<{ text: string }> }>;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
  }): AsyncIterable<{ text: string; done: boolean }> {
    try {
      const { model, messages, systemPrompt, temperature = 0.7, maxTokens = 2048 } = params;
      
      this.logger.log(`Generating streaming response with model: ${model}`);
      
      const genModel = this.genAI.getGenerativeModel({
        model,
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
        }
      });
      
      const contents = messages;
      const streamResult = await genModel.generateContentStream({
        contents,
        systemInstruction: systemPrompt
      });
      
      let responseText = '';
      
      for await (const chunk of streamResult.stream) {
        const chunkText = chunk.text();
        if (chunkText) {
          responseText += chunkText;
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
   * Generate non-streaming response from Google Gemini API
   */
  async generateResponse(params: {
    model: string;
    messages: Array<{ role: string; parts: Array<{ text: string }> }>;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<string> {
    try {
      const { model, messages, systemPrompt, temperature = 0.7, maxTokens = 2048 } = params;
      
      this.logger.log(`Generating response with model: ${model}`);
      
      const genModel = this.genAI.getGenerativeModel({
        model,
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
        }
      });
      
      const contents = messages;
      const result = await genModel.generateContent({
        contents,
        systemInstruction: systemPrompt
      });
      
      return result.response.text();
    } catch (error) {
      this.logger.error(`Error generating response: ${error.message}`);
      throw error;
    }
  }
}
