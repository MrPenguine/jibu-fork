import { Module } from '@nestjs/common';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';
import { WebhookUrlModule } from '../../../core/webhook/webhook-url.module';
import { ServicesModule } from '../../../core/services/services.module';
import { AgentRuntimeModule } from '../../../integrations/agent/agent-runtime.module';

/**
 * ChatsModule routes web-chat turns to the single-brain runtime when an agent is
 * attached, and keeps the legacy n8n webhook path for pure workflow chats.
 */
@Module({
  imports: [WebhookUrlModule, ServicesModule, AgentRuntimeModule],
  controllers: [ChatsController],
  providers: [ChatsService],
  exports: [ChatsService],
})
export class ChatsModule {}