import { Controller, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { AgentExecutionService } from '../execution/agent-execution.service';
import { ExecuteAgentDto, ContinueAgentDto } from '../dto';
import { JwtAuthGuard } from '../../../../core/auth/guards/jwt-auth.guard';
import { OrgRoleGuard } from '../../../../core/auth/guards/org-role.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AgentSessionOutput } from '../../../../../../../libs/src';

@ApiTags('agent-execution')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrgRoleGuard)
@Controller('v1/agent-execution')
export class AgentExecutionController {
  constructor(private readonly agentExecutionService: AgentExecutionService) {}

  @Post('agents/:agentId/execute')
  @ApiOperation({ summary: 'Execute a agent' })
  @ApiResponse({ status: 201, description: 'The agent has been successfully executed.' })
  @ApiResponse({ status: 404, description: 'Agent not found.' })
  execute(
    @Param('agentId') agentId: string,
    @Body() executeAgentDto: ExecuteAgentDto,
    @Req() req,
  ): Promise<AgentSessionOutput> {
    const organizationId = req.user.organizationId;
    return this.agentExecutionService.initiate(
      agentId,
      organizationId,
      executeAgentDto.initialVariables,
      executeAgentDto.chatId,
      executeAgentDto.callSid,
    );
  }

  @Post('sessions/:sessionId/continue')
  @ApiOperation({ summary: 'Continue a paused agent session' })
  @ApiResponse({ status: 201, description: 'The agent session has been successfully continued.' })
  @ApiResponse({ status: 404, description: 'Agent session not found.' })
  continue(
    @Param('sessionId') sessionId: string,
    @Body() continueAgentDto: ContinueAgentDto,
    @Req() req,
  ): Promise<AgentSessionOutput> {
    const organizationId = req.user.organizationId;
    return this.agentExecutionService.continue(
      sessionId,
      continueAgentDto.userInput
    );
  }
}
