import { Module } from '@nestjs/common';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';
import { DatabaseModule } from '../../../core/database/database.module';
import { RedisModule } from '../../../core/redis/redis.module';
import { N8nOrchestratorModule } from '../../../core/n8n-orchestrator/n8n-orchestrator.module';

@Module({
  imports: [DatabaseModule, RedisModule, N8nOrchestratorModule],
  controllers: [ChatsController],
  providers: [ChatsService],
  exports: [ChatsService]
})
export class ChatsModule {}