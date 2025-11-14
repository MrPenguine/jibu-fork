import { Module } from '@nestjs/common';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';
import { DatabaseModule } from '../../../core/database/database.module';

/**
 * ChatsModule - Minimal chat management module
 * 
 * Provides basic CRUD operations for chats and messages.
 * All complex integrations (Redis, N8N, webhooks) have been removed.
 * Future chat processing will be handled by n8n workflows.
 */
@Module({
  imports: [DatabaseModule],
  controllers: [ChatsController],
  providers: [ChatsService],
  exports: [ChatsService]
})
export class ChatsModule {}