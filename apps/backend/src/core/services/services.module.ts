import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QUEUE_NAMES } from '@jibu/queue-definitions';
import { WebhookCacheService, REDIS_SERVICE_TOKEN } from '@jibu/cache-utils';
import { RedisService } from '../redis/redis.service';
import { ConnectionService } from './connection.service';
import { MessageQueueService } from './message-queue.service';

/**
 * Module for core services including connection management and message queuing
 */
@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_NAMES.WEBHOOK_DELIVERY }),
  ],
  providers: [
    ConnectionService,
    MessageQueueService,
    WebhookCacheService,
    RedisService,
    // Bind shared Redis token to the concrete RedisService in backend
    { provide: REDIS_SERVICE_TOKEN, useExisting: RedisService },
  ],
  exports: [ConnectionService, MessageQueueService],
})
export class ServicesModule {}
