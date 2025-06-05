import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../core/database/prisma.module';
import { WorkflowService } from './services/workflow.service';
import { WorkflowController } from './controllers/workflow.controller';

@Module({
  imports: [PrismaModule],
  providers: [WorkflowService],
  controllers: [WorkflowController],
  exports: [WorkflowService],
})
export class WorkflowModule {}
