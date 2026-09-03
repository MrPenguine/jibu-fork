import { Module } from '@nestjs/common';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';
import { ServicesModule } from '../../../core/services/services.module';
import { AgentRuntimeModule } from '../../../integrations/agent/agent-runtime.module';

/**
 * ChatsModule routes web-chat turns to the single-brain runtime when an agent is
 * attached.
 */
@Module({
  imports: [ServicesModule, AgentRuntimeModule],
  controllers: [ChatsController],
  providers: [ChatsService],
  exports: [ChatsService],
})
export class ChatsModule {}