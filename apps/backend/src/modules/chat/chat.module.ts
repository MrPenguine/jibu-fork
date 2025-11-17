import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatModule as CoreChatModule } from '../../core/chat/chat.module';
import { MessageQueueService } from '../../core/services/message-queue.service';
import { BullModule } from '@nestjs/bull';
import { QUEUE_NAMES } from '@jibu/queue-definitions';
import { WebhookCacheService, REDIS_SERVICE_TOKEN } from '@jibu/cache-utils';
import { ConnectionService } from '../../core/services/connection.service';
import { RagContextService } from '../../core/services/rag-context.service';
import { RedisModule } from '../../core/redis/redis.module';
import { RedisService } from '../../core/redis/redis.service';

/**
 * Chat API Module
 * Exposes REST endpoints for chat functionality
 */
@Module({
  imports: [
    CoreChatModule,
    RedisModule,
    BullModule.registerQueue({
      name: QUEUE_NAMES.WEBHOOK_DELIVERY,
    }),
  ],
  controllers: [ChatController],
  providers: [
    MessageQueueService,
    ConnectionService,
    RagContextService,
    WebhookCacheService,
    RedisService,
    { provide: REDIS_SERVICE_TOKEN, useExisting: RedisService },
  ],
})
export class ChatModule {}
