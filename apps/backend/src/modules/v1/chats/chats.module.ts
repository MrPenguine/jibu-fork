import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';
import { ChatIdleSweepService } from './chat-idle-sweep.service';
import { ServicesModule } from '../../../core/services/services.module';
import { AgentRuntimeModule } from '../../../integrations/agent/agent-runtime.module';
import { QueueModule } from '../../../core/queue/queue.module';

/**
 * ChatsModule routes web-chat turns to the single-brain runtime when an agent is
 * attached, and runs the idle-timeout sweep for chat sessions.
 */
@Module({
  // ScheduleModule.forRoot() is safe to call from multiple modules (Nest
  // dedupes it), matching VoicesService/PhoneNumberService's own convention.
  imports: [ServicesModule, AgentRuntimeModule, QueueModule, ScheduleModule.forRoot()],
  controllers: [ChatsController],
  providers: [ChatsService, ChatIdleSweepService],
  exports: [ChatsService],
})
export class ChatsModule {}