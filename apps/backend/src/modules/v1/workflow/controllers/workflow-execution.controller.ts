import { Controller, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { WorkflowExecutionService } from '../execution/workflow-execution.service';
import { ExecuteWorkflowDto, ContinueWorkflowDto } from '../dto';
import { JwtAuthGuard } from '../../../../core/auth/guards/jwt-auth.guard';
import { OrgRoleGuard } from '../../../../core/auth/guards/org-role.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { WorkflowSessionOutput } from '../../../../../../../libs/src';

@ApiTags('workflow-execution')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrgRoleGuard)
@Controller('v1/workflow-execution')
export class WorkflowExecutionController {
  constructor(private readonly workflowExecutionService: WorkflowExecutionService) {}

  @Post('workflows/:workflowId/execute')
  @ApiOperation({ summary: 'Execute a workflow' })
  @ApiResponse({ status: 201, description: 'The workflow has been successfully executed.' })
  @ApiResponse({ status: 404, description: 'Workflow not found.' })
  execute(
    @Param('workflowId') workflowId: string,
    @Body() executeWorkflowDto: ExecuteWorkflowDto,
    @Req() req,
  ): Promise<WorkflowSessionOutput> {
    const organizationId = req.user.organizationId;
    return this.workflowExecutionService.initiate(
      workflowId,
      organizationId,
      executeWorkflowDto.initialVariables,
      executeWorkflowDto.chatId,
      executeWorkflowDto.callSid,
    );
  }

  @Post('sessions/:sessionId/continue')
  @ApiOperation({ summary: 'Continue a paused workflow session' })
  @ApiResponse({ status: 201, description: 'The workflow session has been successfully continued.' })
  @ApiResponse({ status: 404, description: 'Workflow session not found.' })
  continue(
    @Param('sessionId') sessionId: string,
    @Body() continueWorkflowDto: ContinueWorkflowDto,
    @Req() req,
  ): Promise<WorkflowSessionOutput> {
    const organizationId = req.user.organizationId;
    return this.workflowExecutionService.continue(
      sessionId,
      continueWorkflowDto.userInput
    );
  }
}
