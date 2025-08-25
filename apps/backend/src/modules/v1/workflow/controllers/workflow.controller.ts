import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../core/auth/guards/jwt-auth.guard';
import { WorkflowService } from '../services/workflow.service';
import { CreateWorkflowDto, UpdateWorkflowDto, CreateSecondaryWorkflowDto } from '../dto';

@ApiTags('workflows')
@Controller('v1/workflows')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Get('agent/:agentId/workflows')
  @ApiOperation({ summary: 'Get all workflows for an agent' })
  async getAgentWorkflows(@Param('agentId') agentId: string, @Req() req) {
    const workspaceId =
      req.user?.workspaceId ||
      req.user?.lastWorkspaceId ||
      (req.headers['x-workspace-id'] as string);
    if (!workspaceId) {
      throw new BadRequestException('No workspace selected');
    }
    return this.workflowService.getAgentWorkflows(agentId, workspaceId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get workflow by ID' })
  async getWorkflow(@Param('id') id: string) {
    return this.workflowService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new workflow (master or secondary)' })
  async create(@Body() createWorkflowDto: CreateWorkflowDto, @Req() req) {
    const workspaceId =
      req.user?.workspaceId ||
      req.user?.lastWorkspaceId ||
      (req.headers['x-workspace-id'] as string);

    if (!workspaceId) {
      throw new BadRequestException('No workspace selected');
    }

    // Ensure the DTO has the workspaceId
    createWorkflowDto.workspaceId = workspaceId;

    return this.workflowService.create(createWorkflowDto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a workflow' })
  async updateWorkflow(
    @Param('id') id: string,
    @Body() updateWorkflowDto: UpdateWorkflowDto,
    @Req() req,
  ) {
    const workspaceId =
      req.user?.workspaceId ||
      req.user?.lastWorkspaceId ||
      (req.headers['x-workspace-id'] as string);
    if (!workspaceId) {
      throw new BadRequestException('No workspace selected');
    }

    return this.workflowService.updateWorkflow(id, {
      ...updateWorkflowDto,
      workspaceId,
    });
  }

  @Put(':id/publish')
  @ApiOperation({ summary: 'Publish a workflow' })
  async publishWorkflow(@Param('id') id: string) {
    return this.workflowService.publishWorkflow(id);
  }

  @Put(':id/unpublish')
  @ApiOperation({ summary: 'Unpublish a workflow' })
  async unpublishWorkflow(@Param('id') id: string) {
    return this.workflowService.unpublishWorkflow(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a workflow' })
  async deleteWorkflow(@Param('id') id: string) {
    return this.workflowService.deleteWorkflow(id);
  }
}
