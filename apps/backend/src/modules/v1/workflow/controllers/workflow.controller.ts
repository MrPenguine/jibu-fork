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

  @Post('agent/:agentId')
  @ApiOperation({ summary: 'Create a new master workflow for an agent' })
  async createMasterWorkflow(
    @Param('agentId') agentId: string,
    @Body() createWorkflowDto: CreateWorkflowDto,
    @Req() req,
  ) {
    const workspaceId =
      req.user?.workspaceId ||
      req.user?.lastWorkspaceId ||
      (req.headers['x-workspace-id'] as string);
    if (!workspaceId) {
      throw new BadRequestException('No workspace selected');
    }
    return this.workflowService.createMasterWorkflow(agentId, {
      ...createWorkflowDto,
      workspaceId,
    });
  }

  @Post(':masterWorkflowId/secondary')
  @ApiOperation({ summary: 'Create a secondary workflow' })
  async createSecondaryWorkflow(
    @Param('masterWorkflowId') masterWorkflowId: string,
    @Body() createSecondaryWorkflowDto: CreateSecondaryWorkflowDto,
    @Req() req,
    @Query('agentId') queryAgentId?: string,
  ) {
    const workspaceId =
      req.user?.workspaceId ||
      req.user?.lastWorkspaceId ||
      (req.headers['x-workspace-id'] as string);
    if (!workspaceId) {
      throw new BadRequestException('No workspace selected');
    }

    let agentId = queryAgentId;
    if (!agentId) {
      try {
        console.log(`Retrieving agentId for master workflow ${masterWorkflowId}`);
        const masterWorkflow = await this.workflowService.findById(masterWorkflowId);
        if (!masterWorkflow) {
          throw new NotFoundException(`Master workflow with ID ${masterWorkflowId} not found`);
        }
        agentId = masterWorkflow.agentId;
        console.log(`Using agentId ${agentId} from master workflow`);
      } catch (error) {
        console.error('Error retrieving master workflow:', error);
        throw new NotFoundException(`Master workflow with ID ${masterWorkflowId} not found or inaccessible`);
      }
    }

    if (!agentId) {
      throw new BadRequestException('Agent ID is required to create a secondary workflow');
    }

    return this.workflowService.createSecondaryWorkflow(
      masterWorkflowId,
      createSecondaryWorkflowDto,
      agentId,
      workspaceId,
    );
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
