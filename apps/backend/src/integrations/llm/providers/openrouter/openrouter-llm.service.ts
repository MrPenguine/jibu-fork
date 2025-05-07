import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAI } from 'openai';
import { ILlmService, LlmAgentConfig, LlmResponse } from '../../interfaces/llm.interface';

@Injectable()
export class OpenRouterLlmService implements ILlmService {
  private readonly logger = new Logger(OpenRouterLlmService.name);
  private openai: OpenAI;
  private readonly defaultModel = 'mistralai/mixtral-8x7b-instruct';

  constructor(private readonly configService: ConfigService) {
    this.openai = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: this.configService.get('OPEN_ROUTER_API_KEY'),
      defaultHeaders: {
        'HTTP-Referer': this.configService.get('OPENROUTER_REFERRER'),
        'X-Title': this.configService.get('OPENROUTER_TITLE'),
      },
    });

    this.logger.log('OpenRouter LLM service initialized');
  }

  async checkConnection(): Promise<boolean> {
    try {
      // Make a simple models request to verify API key is working
      const models = await this.openai.models.list();
      this.logger.log(`OpenRouter connection successful, models available: ${models.data.length}`);
      return true;
    } catch (error) {
      this.logger.error(`OpenRouter connection failed: ${error.message}`);
      return false;
    }
  }

  async generateResponse(
    prompt: string,
    config?: LlmAgentConfig,
  ): Promise<LlmResponse> {
    try {
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: prompt },
      ];

      const completion = await this.openai.chat.completions.create({
        model: config?.model || this.defaultModel,
        messages,
        temperature: config?.temperature || 0.7,
        max_tokens: config?.maxTokens || 1000,
      });

      const choice = completion.choices[0];
      
      return {
        text: choice?.message?.content || '',
        modelUsed: completion.model,
        tokenUsage: {
          promptTokens: completion.usage?.prompt_tokens || 0,
          completionTokens: completion.usage?.completion_tokens || 0,
          totalTokens: completion.usage?.total_tokens || 0,
        },
      };
    } catch (error) {
      this.logger.error('OpenRouter API Error:', error);
      throw new ServiceUnavailableException(
        'Failed to generate response from LLM service',
      );
    }
  }
} 