import { Module } from '@nestjs/common';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { DatabaseModule } from '../../../core/database/database.module';
import { QueueModule } from '../../../core/queue/queue.module';
import { N8nIntegrationModule } from '../../../integrations/n8n/n8n-integration.module';

@Module({
  imports: [DatabaseModule, QueueModule, N8nIntegrationModule],
  controllers: [AssistantController],
  providers: [AssistantService],
  exports: [AssistantService],
})
export class AssistantModule {}