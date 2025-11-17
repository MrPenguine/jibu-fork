import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ChatService } from './chat.service';
import { ChatCleanupService } from './cleanup.service';
import { RedisModule } from '../redis/redis.module';
import { RagContextService } from '../services/rag-context.service';

/**
 * ChatModule - Redis-based conversation management
 * Phase 4: High-performance chat system
 * 
 * Features:
 * - Redis-based conversation storage
 * - Automated cleanup with cron jobs
 * - Context-aware caching
 * - Session management
 */
@Module({
  imports: [
    RedisModule,
    ScheduleModule.forRoot(), // Enable cron jobs
  ],
  providers: [
    ChatService,
    ChatCleanupService,
    RagContextService,
  ],
  exports: [ChatService, ChatCleanupService],
})
export class ChatModule {}
