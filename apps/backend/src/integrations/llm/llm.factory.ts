import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ILlmService } from './interfaces/llm.interface';
import { OpenRouterLlmService } from './providers/openrouter/openrouter-llm.service';

export const llmServiceFactory: Provider = {
  provide: ILlmService,
  useFactory: (configService: ConfigService, openRouterService: OpenRouterLlmService) => {
    // For now, we just return the OpenRouter service
    // In the future, this could select between multiple LLM providers
    return openRouterService;
  },
  inject: [ConfigService, OpenRouterLlmService],
}; 