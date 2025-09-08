import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../../core/database/prisma.module';
import { WorkflowService } from './services/workflow.service';
import { WorkflowController } from './controllers/workflow.controller';
import { N8nOrchestratorModule } from '../../../core/n8n-orchestrator/n8n-orchestrator.module';
import { QueueModule } from '../../../core/queue/queue.module';

@Module({
  imports: [PrismaModule, N8nOrchestratorModule, QueueModule],
  providers: [WorkflowService],
  controllers: [WorkflowController],
  exports: [WorkflowService],
})
export class WorkflowModule {}
