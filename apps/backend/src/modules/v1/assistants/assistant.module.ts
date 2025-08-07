import { Module } from '@nestjs/common';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { DatabaseModule } from '../../../core/database/database.module';
import { QueueModule } from '../../../core/queue/queue.module';
// N8N integration import removed

@Module({
  imports: [DatabaseModule, QueueModule], // N8N integration module removed
  controllers: [AssistantController],
  providers: [AssistantService],
  exports: [AssistantService],
})
export class AssistantModule {}