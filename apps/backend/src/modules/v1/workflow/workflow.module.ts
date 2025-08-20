import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../../core/database/prisma.module';
import { WorkflowService } from './services/workflow.service';
import { WorkflowController } from './controllers/workflow.controller';
import { N8nIntegrationModule } from '../../../integrations/n8n/n8n-integration.module';
import { N8nOrchestratorModule } from '../../../core/n8n-orchestrator/n8n-orchestrator.module';
import { N8nModule } from '../n8n/n8n.module';

@Module({
  imports: [PrismaModule, N8nIntegrationModule, N8nOrchestratorModule, forwardRef(() => N8nModule)],
  providers: [WorkflowService],
  controllers: [WorkflowController],
  exports: [WorkflowService],
})
export class WorkflowModule {}
