import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from '../../../core/database/prisma.module';
import { ToolsModule } from '../tools/tools.module';
import { AssistantsModule } from '../assistants/assistants.module';
import { WorkflowController } from './controllers/workflow.controller';
import { WorkflowExecutionController } from './controllers/workflow-execution.controller';
import { WorkflowService } from './services/workflow.service';
import { WorkflowExecutionService } from './execution/workflow-execution.service';

@Module({
  imports: [
    PrismaModule,
    HttpModule,
    forwardRef(() => ToolsModule),
    forwardRef(() => AssistantsModule),
  ],
  controllers: [WorkflowController, WorkflowExecutionController],
  providers: [WorkflowService, WorkflowExecutionService],
  exports: [WorkflowService, WorkflowExecutionService],
})
export class WorkflowModule {}
