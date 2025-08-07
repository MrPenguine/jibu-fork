import { Module } from '@nestjs/common';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';
import { DatabaseModule } from '../../../core/database/database.module';
import { RedisModule } from '../../../core/redis/redis.module';
// N8N orchestrator import removed

@Module({
  imports: [DatabaseModule, RedisModule], // N8N orchestrator module removed
  controllers: [ChatsController],
  providers: [ChatsService],
  exports: [ChatsService]
})
export class ChatsModule {}