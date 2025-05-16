import { Logger } from '@nestjs/common';

/**
 * Mistral AI provider implementation
 */
export class MistralProvider {
  private readonly logger = new Logger(MistralProvider.name);
  
  constructor(private readonly apiKey: string) {
    if (!apiKey) {
      this.logger.warn('Mistral API key is not configured');
    }
  }
  
  /**
   * Check connection to Mistral API
   */
  async checkConnection(): Promise<boolean> {
    try {
      if (!this.apiKey) {
        return false;
      }
      
      // Simple connection check - try to list models
      const response = await fetch('https://api.mistral.ai/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to connect to Mistral API: ${response.statusText}`);
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to check connection: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Generate streaming response from Mistral API
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
      
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          temperature,
          max_tokens: maxTokens
        })
      });
      
      if (!response.ok) {
        throw new Error(`Mistral API error: ${response.status} ${response.statusText}`);
      }
      
      if (!response.body) {
        throw new Error('Response body is null');
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let responseText = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          yield { text: responseText, done: true };
          break;
        }
        
        // Decode the chunk and add it to the buffer
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete SSE messages
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const data = JSON.parse(line.substring(6));
              const content = data.choices[0]?.delta?.content || '';
              if (content) {
                responseText += content;
                yield { text: responseText, done: false };
              }
            } catch (e) {
              this.logger.error(`Error parsing SSE message: ${e.message}`);
            }
          }
        }
      }
    } catch (error) {
      this.logger.error(`Error generating response: ${error.message}`);
      throw error;
    } finally {
      // Ensure reader is released if an error occurs
      // This is handled by the browser/Node.js runtime
    }
  }
  
  /**
   * Generate non-streaming response from Mistral API
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
      
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxTokens
        })
      });
      
      if (!response.ok) {
        throw new Error(`Mistral API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.choices[0]?.message?.content || '';
    } catch (error) {
      this.logger.error(`Error generating response: ${error.message}`);
      throw error;
    }
  }
}
