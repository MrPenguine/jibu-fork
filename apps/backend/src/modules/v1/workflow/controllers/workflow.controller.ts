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
  Logger,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../core/auth/guards/jwt-auth.guard';
import { WorkflowService } from '../services/workflow.service';
import { OrchestratorService } from '../../../../core/n8n-orchestrator/orchestrator.service';
import { CompileContextBuilder } from '../../../../core/n8n-orchestrator/compile-context.builder';
import { QueueService } from '../../../../core/queue/queue.service';
import { JOB_NAMES } from '@jibu/queue-definitions';
import { CreateWorkflowDto, UpdateWorkflowDto } from '../dto';

@ApiTags('workflows')
@Controller('v1/workflows')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WorkflowController {
  constructor(
    private readonly workflowService: WorkflowService,
    private readonly orchestrator: OrchestratorService,
    private readonly queueService: QueueService,
    private readonly ctxBuilder: CompileContextBuilder,
  ) {}

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

  @Get(':id/publish-status')
  @ApiOperation({ summary: 'Get publish job status and n8n workflow snapshot' })
  async publishStatus(@Param('id') id: string, @Req() req, @Query('jobId') jobId?: string) {
    const workspaceId =
      req.user?.workspaceId ||
      req.user?.lastWorkspaceId ||
      (req.headers['x-workspace-id'] as string);
    if (!workspaceId) {
      throw new BadRequestException('No workspace selected');
    }

    let jobState: any = null;
    if (jobId) {
      const job = await this.queueService.getPublishJob(jobId);
      if (job) {
        jobState = {
          id: job.id,
          state: await job.getState(),
          progress: job.progress(),
          failedReason: job.failedReason,
          returnvalue: job.returnvalue,
        };
      }
    }

    // Load DB snapshot
    const wf = await this.workflowService.findById(id);
    if (!wf) {
      throw new BadRequestException('Workflow not found');
    }

    // Pull N8nWorkflow record if linked
    // We can't import Prisma service here easily; reuse workflowService response if it includes linkage
    // For a richer snapshot, the client can call a dedicated endpoint; this returns the basics
    const snapshot = {
      workflowId: id,
      n8nWorkflowId: (wf as any).n8nWorkflowId || null,
      isPublished: (wf as any).isPublished ?? null,
      hasDraft: (wf as any).hasDraft ?? null,
    };

    return {
      job: jobState,
      workflow: snapshot,
    };
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
  @ApiOperation({ summary: 'Publish a workflow (also compiles to n8n and enqueues auto-activation)' })
  async publishWorkflow(@Param('id') id: string, @Req() req) {
    const logger = new Logger('WorkflowController');
    logger.log(`[DIAGNOSTIC] 🚀 Starting publish workflow for ID: ${id}`);
    
    try {
      // First, set the workflow version to published using the existing service
      logger.log(`[DIAGNOSTIC] Step 1: Publishing workflow version...`);
      const published = await this.workflowService.publishWorkflow(id);
      logger.log(`[DIAGNOSTIC] ✅ Step 1 complete: Workflow version published`);

      // Resolve workspace context (same header resolution used elsewhere)
      const workspaceId =
        req.user?.workspaceId ||
        req.user?.lastWorkspaceId ||
        (req.headers['x-workspace-id'] as string);
      if (!workspaceId) {
        logger.error(`[DIAGNOSTIC] ❌ No workspace ID found in request`);
        throw new BadRequestException('No workspace selected');
      }
      logger.log(`[DIAGNOSTIC] Workspace ID resolved: ${workspaceId}`);

      // Compile and persist compiled JSON into N8nWorkflow
      logger.log(`[DIAGNOSTIC] Step 2: Compiling and persisting to N8nWorkflow...`);
      const { n8nWorkflowDbId, hash } = await this.orchestrator.compileAndPersist(id, workspaceId);
      logger.log(`[DIAGNOSTIC] ✅ Step 2 complete: Compiled. N8nWorkflowDbId: ${n8nWorkflowDbId}, Hash: ${hash}`);

      // Enqueue publish with auto-activate
      logger.log(`[DIAGNOSTIC] Step 3: Enqueueing publish job to worker...`);
      const job = await this.queueService.addPublishWorkflowJob({
        workflowId: id,
        workspaceId,
        n8nWorkflowDbId,
        activate: true,
      });
      logger.log(`[DIAGNOSTIC] ✅ Step 3 complete: Job enqueued with ID: ${job.id}`);

      const result = {
        published,
        enqueue: {
          accepted: true,
          jobId: job.id,
          n8nWorkflowDbId,
          hash,
        },
      };
      
      logger.log(`[DIAGNOSTIC] 🎉 Publish workflow completed successfully. Job ID: ${job.id}`);
      return result;
    } catch (error: any) {
      logger.error(`[DIAGNOSTIC] ❌ Publish workflow failed for ID ${id}: ${error.message}`, error.stack);
      
      // Check if this is the missing LLM configuration error
      // NestJS BadRequestException wraps the response in error.response
      const errorResponse = error?.response || error;
      
      logger.log(`[DIAGNOSTIC] Error response structure: ${JSON.stringify({ 
        hasResponse: !!error?.response, 
        responseError: error?.response?.error,
        directError: error?.error,
        message: error?.message 
      })}`);
      
      if (errorResponse?.error === 'MISSING_LLM_CONFIGURATION') {
        logger.log(`[DIAGNOSTIC] Detected MISSING_LLM_CONFIGURATION, re-throwing as ASSISTANT_SETUP_INCOMPLETE`);
        throw new BadRequestException({
          message: 'Assistant setup incomplete',
          error: 'ASSISTANT_SETUP_INCOMPLETE',
          details: errorResponse.details,
        });
      }
      
      throw error;
    }
  }

  @Post(':id/publish-n8n')
  @ApiOperation({ summary: 'Compile to n8n JSON and enqueue async publish to n8n (auto-activate)' })
  async publishToN8n(@Param('id') id: string, @Req() req) {
    const workspaceId =
      req.user?.workspaceId ||
      req.user?.lastWorkspaceId ||
      (req.headers['x-workspace-id'] as string);
    if (!workspaceId) {
      throw new BadRequestException('No workspace selected');
    }

    // Compile and persist compiled JSON into N8nWorkflow
    const { n8nWorkflowDbId, hash, compiled } = await this.orchestrator.compileAndPersist(id, workspaceId);

    // Enqueue publish with auto-activate
    const job = await this.queueService.addPublishWorkflowJob({
      workflowId: id,
      workspaceId,
      n8nWorkflowDbId,
      activate: true,
    });

    return {
      accepted: true,
      jobId: job.id,
      n8nWorkflowDbId,
      hash,
    };
  }

  @Put(':id/unpublish')
  @ApiOperation({ summary: 'Unpublish a workflow' })
  async unpublishWorkflow(@Param('id') id: string) {
    return this.workflowService.unpublishWorkflow(id);
  }

  @Get(':id/compiled-json')
  @ApiOperation({ summary: 'Preview compiled n8n JSON (shared lib) without pushing to n8n' })
  async compiledJson(@Param('id') id: string, @Req() req) {
    const workspaceId =
      req.user?.workspaceId ||
      req.user?.lastWorkspaceId ||
      (req.headers['x-workspace-id'] as string);
    if (!workspaceId) {
      throw new BadRequestException('No workspace selected');
    }

    // Reuse OrchestratorService to compile and persist locally (no n8n call)
    const { compiled, hash } = await this.orchestrator.compileAndPersist(id, workspaceId);
    return { hash, compiled };
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'List workflow versions (metadata only)' })
  async listWorkflowVersions(@Param('id') id: string, @Req() req) {
    const workspaceId =
      req.user?.workspaceId ||
      req.user?.lastWorkspaceId ||
      (req.headers['x-workspace-id'] as string);
    if (!workspaceId) {
      throw new BadRequestException('No workspace selected');
    }
    return this.workflowService.listVersions(id, workspaceId);
  }

  @Get(':id/versions/:version')
  @ApiOperation({ summary: 'Get a specific workflow version (by number or tag: draft|published|live)' })
  async getWorkflowVersion(
    @Param('id') id: string,
    @Param('version') version: string,
    @Req() req,
  ) {
    const workspaceId =
      req.user?.workspaceId ||
      req.user?.lastWorkspaceId ||
      (req.headers['x-workspace-id'] as string);
    if (!workspaceId) {
      throw new BadRequestException('No workspace selected');
    }
    return this.workflowService.getVersion(id, version, workspaceId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a workflow' })
  async deleteWorkflow(@Param('id') id: string) {
    return this.workflowService.deleteWorkflow(id);
  }
}
