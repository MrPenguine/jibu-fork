import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../core/database/prisma.module';
import { WorkflowService } from './services/workflow.service';
import { WorkflowController } from './controllers/workflow.controller';
import { WorkflowSynchronizerService } from './workflow-synchronizer.service';
import { N8nIntegrationModule } from '../../../integrations/n8n/n8n-integration.module';
import { N8nOrchestratorModule } from '../../../core/n8n-orchestrator/n8n-orchestrator.module';

@Module({
  imports: [PrismaModule, N8nIntegrationModule, N8nOrchestratorModule],
  providers: [WorkflowService, WorkflowSynchronizerService],
  controllers: [WorkflowController],
  exports: [WorkflowService, WorkflowSynchronizerService],
})
export class WorkflowModule {}
