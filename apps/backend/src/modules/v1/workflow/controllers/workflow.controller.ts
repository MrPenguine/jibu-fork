import { Controller, Get, Post, Body, Param, Delete, Put, UseGuards, Req } from '@nestjs/common';
import { WorkflowService } from '../services/workflow.service';
import { CreateWorkflowDto, UpdateWorkflowDto } from '../dto';
import { JwtAuthGuard } from '../../../../core/auth/guards/jwt-auth.guard';
import { OrgRoleGuard } from '../../../../core/auth/guards/org-role.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Workflow } from '@prisma/client';

@ApiTags('workflows')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrgRoleGuard)
@Controller('v1/workflows')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new workflow' })
  @ApiResponse({ status: 201, description: 'The workflow has been successfully created.' })
  create(@Body() createWorkflowDto: CreateWorkflowDto, @Req() req): Promise<Workflow> {
    const organizationId = req.user.organizationId;
    return this.workflowService.create(createWorkflowDto, organizationId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all workflows for the organization' })
  @ApiResponse({ status: 200, description: 'Return all workflows for the organization.' })
  findAll(@Req() req): Promise<Workflow[]> {
    const organizationId = req.user.organizationId;
    return this.workflowService.findAll(organizationId);
  }

  @Get('assistant/:assistantId')
  @ApiOperation({ summary: 'Get all workflows for a specific assistant' })
  @ApiResponse({ status: 200, description: 'Return all workflows for the assistant.' })
  findAllByAssistant(@Param('assistantId') assistantId: string, @Req() req): Promise<Workflow[]> {
    const organizationId = req.user.organizationId;
    return this.workflowService.findAllByAssistant(assistantId, organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a workflow by ID' })
  @ApiResponse({ status: 200, description: 'Return the workflow.' })
  @ApiResponse({ status: 404, description: 'Workflow not found.' })
  findOne(@Param('id') id: string, @Req() req): Promise<Workflow> {
    const organizationId = req.user.organizationId;
    return this.workflowService.findOne(id, organizationId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a workflow' })
  @ApiResponse({ status: 200, description: 'The workflow has been successfully updated.' })
  @ApiResponse({ status: 404, description: 'Workflow not found.' })
  update(
    @Param('id') id: string,
    @Body() updateWorkflowDto: UpdateWorkflowDto,
    @Req() req,
  ): Promise<Workflow> {
    const organizationId = req.user.organizationId;
    return this.workflowService.update(id, updateWorkflowDto, organizationId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a workflow' })
  @ApiResponse({ status: 200, description: 'The workflow has been successfully deleted.' })
  @ApiResponse({ status: 404, description: 'Workflow not found.' })
  remove(@Param('id') id: string, @Req() req): Promise<Workflow> {
    const organizationId = req.user.organizationId;
    return this.workflowService.remove(id, organizationId);
  }

  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish a workflow' })
  @ApiResponse({ status: 200, description: 'The workflow has been successfully published.' })
  @ApiResponse({ status: 404, description: 'Workflow not found.' })
  publish(@Param('id') id: string, @Req() req): Promise<Workflow> {
    const organizationId = req.user.organizationId;
    return this.workflowService.publish(id, organizationId);
  }

  @Post(':id/unpublish')
  @ApiOperation({ summary: 'Unpublish a workflow' })
  @ApiResponse({ status: 200, description: 'The workflow has been successfully unpublished.' })
  @ApiResponse({ status: 404, description: 'Workflow not found.' })
  unpublish(@Param('id') id: string, @Req() req): Promise<Workflow> {
    const organizationId = req.user.organizationId;
    return this.workflowService.unpublish(id, organizationId);
  }
}
