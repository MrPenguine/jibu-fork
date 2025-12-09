import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QUEUE_NAMES } from '@jibu/queue-definitions';
import { WebhookCacheService, REDIS_SERVICE_TOKEN, IRedisService } from '@jibu/cache-utils';
import { RedisService } from '../redis/redis.service';
import { ConnectionService } from './connection.service';
import { MessageQueueService } from './message-queue.service';
import { RagContextService } from './rag-context.service';
import { ChatHistoryService } from './chat-history.service';
import { AgentPromptsService } from './agent-prompts.service';
import {
  PayloadBuilderService,
  RAG_CONTEXT_PROVIDER_TOKEN,
  AGENT_PROMPTS_PROVIDER_TOKEN,
} from '@jibu/payload-builder';

/**
 * Module for core services including connection management, message queuing, and RAG context
 */
@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_NAMES.WEBHOOK_DELIVERY }),
  ],
  providers: [
    ConnectionService,
    MessageQueueService,
    RagContextService,
    RedisService,
    ChatHistoryService,
    AgentPromptsService,
    // Bind shared Redis token to the concrete RedisService in backend
    { provide: REDIS_SERVICE_TOKEN, useExisting: RedisService },
    {
      provide: WebhookCacheService,
      useFactory: (redisService: IRedisService) => new WebhookCacheService(redisService),
      inject: [REDIS_SERVICE_TOKEN],
    },
    { provide: RAG_CONTEXT_PROVIDER_TOKEN, useExisting: RagContextService },
    { provide: 'ChatsService', useExisting: ChatHistoryService },
    { provide: AGENT_PROMPTS_PROVIDER_TOKEN, useExisting: AgentPromptsService },
    PayloadBuilderService,
  ],
  exports: [ConnectionService, MessageQueueService, RagContextService, PayloadBuilderService],
})
export class ServicesModule {}
