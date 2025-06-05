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
import { OrgRoleGuard } from '../../../../core/auth/guards/org-role.guard';
import { WorkflowService } from '../services/workflow.service';
import { CreateWorkflowDto, UpdateWorkflowDto, CreateSecondaryWorkflowDto } from '../dto';

@ApiTags('workflows')
@Controller('v1/workflows')
@UseGuards(JwtAuthGuard, OrgRoleGuard)
@ApiBearerAuth()
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Get('agent/:agentId/workflows')
  @ApiOperation({ summary: 'Get all workflows for an agent' })
  async getAgentWorkflows(@Param('agentId') agentId: string, @Req() req) {
    const organizationId = req.user.orgId;
    if (!organizationId) {
      throw new BadRequestException('No organization selected');
    }
    return this.workflowService.getAgentWorkflows(agentId, organizationId);
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
    const organizationId = req.user.orgId;
    if (!organizationId) {
      throw new BadRequestException('No organization selected');
    }
    // Add the organization ID to the workflow
    return this.workflowService.createMasterWorkflow(agentId, {
      ...createWorkflowDto,
      organizationId,
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
    const organizationId = req.user.orgId;
    if (!organizationId) {
      throw new BadRequestException('No organization selected');
    }

    // If agentId isn't provided in query, get it from the master workflow
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
      organizationId,
    );
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a workflow' })
  async updateWorkflow(
    @Param('id') id: string,
    @Body() updateWorkflowDto: UpdateWorkflowDto,
  ) {
    return this.workflowService.updateWorkflow(id, updateWorkflowDto);
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
