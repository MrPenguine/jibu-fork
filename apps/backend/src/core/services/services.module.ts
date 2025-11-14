import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QUEUE_NAMES } from '@jibu/queue-definitions';
import { WebhookCacheService, REDIS_SERVICE_TOKEN } from '@jibu/cache-utils';
import { RedisService } from '../redis/redis.service';
import { ConnectionService } from './connection.service';
import { MessageQueueService } from './message-queue.service';
import { RagContextService } from './rag-context.service';

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
    WebhookCacheService,
    RedisService,
    // Bind shared Redis token to the concrete RedisService in backend
    { provide: REDIS_SERVICE_TOKEN, useExisting: RedisService },
  ],
  exports: [ConnectionService, MessageQueueService, RagContextService],
})
export class ServicesModule {}
