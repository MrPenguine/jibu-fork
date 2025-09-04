import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../core/database/prisma.service';
import { CreateWorkflowDto } from '../dto/create-workflow.dto';
import { UpdateWorkflowDto } from '../dto/update-workflow.dto';

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);
  
  constructor(
    private prisma: PrismaService
  ) {}

  /**
   * Find all workflows for an agent, scoped by workspaceId
   */
  async getAgentWorkflows(agentId: string, workspaceId: string) {
    // Verify the agent exists and belongs to the organization
    const agent = await this.prisma.agent.findFirst({
      where: {
        id: agentId,
        workspaceId
      },
    });

    if (!agent) {
      throw new Error(`Agent with ID "${agentId}" not found in organization ${workspaceId}`);
    }

    const workflows = await this.prisma.workflow.findMany({
      where: { 
        agentId,
        workspaceId
      },
    });

    return workflows;
  }

  /**
   * Find a workflow by ID
   */
  async findById(id: string) {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id },
      include: {
        agent: true,
        draftVersion: true,
        publishedVersion: true,
      },
    });

    if (!workflow) return null;

    return this.buildWorkflowResponse(workflow);
  }


  /**
   * Create a new workflow (master or secondary)
   */
  async create(data: CreateWorkflowDto) {
    const { name, description, assistantId, masterWorkflowId, workspaceId, workflowJson } = data;

    const result = await this.prisma.$transaction(async (tx) => {
      // If creating a secondary workflow, ensure master exists
      if (masterWorkflowId) {
        const master = await tx.workflow.findUnique({ where: { id: masterWorkflowId } });
        if (!master) {
          throw new Error('Master workflow not found');
        }
      }

      // Create base workflow
      const created = await tx.workflow.create({
        data: {
          name,
          description,
          isPrimary: !masterWorkflowId,
          agent: { connect: { id: assistantId } },
          workspace: { connect: { id: workspaceId } },
        },
        include: { agent: true, draftVersion: true, publishedVersion: true },
      });

      // If workflowJson provided, create initial draft version (v1) and connect as draft
      if (workflowJson) {
        const initialVersion = await tx.workflowVersion.create({
          data: {
            workflowId: created.id,
            version: 1,
            workflowJson: workflowJson as any,
            status: 'draft',
            publishedAt: null,
          },
        });

        const updated = await tx.workflow.update({
          where: { id: created.id },
          data: { draftVersion: { connect: { id: initialVersion.id } } },
          include: { agent: true, draftVersion: true, publishedVersion: true },
        });

        return updated;
      }

      return created;
    });

    return this.buildWorkflowResponse(result);
  }


  /**
   * Update a workflow
   */
  async updateWorkflow(id: string, data: UpdateWorkflowDto) {
    // If workflowJson provided, create a new draft version and point draftVersionId to it
    if (data.workflowJson) {
      const result = await this.prisma.$transaction(async (tx) => {
        // Ensure workflow exists
        const existing = await tx.workflow.findUnique({ where: { id } });
        if (!existing) throw new BadRequestException('Workflow not found');

        // Compute next version number
        const agg = await tx.workflowVersion.aggregate({
          where: { workflowId: id },
          _max: { version: true },
        });
        const nextVersion = (agg._max.version ?? 0) + 1;

        // Create draft version
        const createdVersion = await tx.workflowVersion.create({
          data: {
            workflowId: id,
            version: nextVersion,
            workflowJson: data.workflowJson as any,
            status: 'draft',
            publishedAt: null,
          },
        });

        // First explicitly update the workflow's draftVersionId field directly
        await tx.workflow.update({
          where: { id },
          data: {
            draftVersionId: createdVersion.id,
          },
        });
        
        // Then update other workflow fields and ensure the relation is connected
        const finalWorkflow = await tx.workflow.update({
          where: { id },
          data: {
            name: data.name ?? existing.name,
            description: data.description ?? existing.description,
            // Update agent link if requested
            ...(data.agentId
              ? { agent: { connect: { id: data.agentId } } }
              : {}),
            // Connect the draft version explicitly
            draftVersion: { connect: { id: createdVersion.id } },
          },
          include: {
            agent: true,
            draftVersion: true,
            publishedVersion: true,
          },
        });

        return finalWorkflow;
      });

      return this.buildWorkflowResponse(result);
    }

    // Fallback: update only basic fields
    const updated = await this.prisma.workflow.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        ...(data.agentId ? { agent: { connect: { id: data.agentId } } } : {}),
      },
      include: {
        agent: true,
        draftVersion: true,
        publishedVersion: true,
      },
    });
    return this.buildWorkflowResponse(updated);
  }

  /**
   * Publish a workflow
   */
  async publishWorkflow(id: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      // Load current pointers
      const workflow = await tx.workflow.findUnique({
        where: { id },
        include: { draftVersion: true, publishedVersion: true },
      });
      if (!workflow) throw new BadRequestException('Workflow not found');

      const toPublish = workflow.draftVersion ?? workflow.publishedVersion;
      if (!toPublish) throw new BadRequestException('No version available to publish');

      // Update the version status to published
      const published = await tx.workflowVersion.update({
        where: { id: toPublish.id },
        data: { status: 'published', publishedAt: new Date() },
      });

      // First explicitly update the workflow's publishedVersionId field directly
      // and clear draftVersionId if it was the same version
      await tx.workflow.update({
        where: { id },
        data: {
          publishedVersionId: published.id,
          ...(workflow.draftVersionId === published.id
            ? { draftVersionId: null }
            : {}),
        },
      });
      
      // Then update the relations to ensure consistency
      const updatedWorkflow = await tx.workflow.update({
        where: { id },
        data: {
          publishedVersion: { connect: { id: published.id } },
          // Clear draft relation if it was the same version
          ...(workflow.draftVersionId === published.id
            ? { draftVersion: { disconnect: true } }
            : {}),
        },
        include: { agent: true, draftVersion: true, publishedVersion: true },
      });

      return updatedWorkflow;
    });

    return this.buildWorkflowResponse(result);
  }

  /**
   * Unpublish a workflow
   */
  async unpublishWorkflow(id: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const workflow = await tx.workflow.findUnique({
        where: { id },
        include: { publishedVersion: true },
      });
      if (!workflow) throw new BadRequestException('Workflow not found');
      if (!workflow.publishedVersion) throw new BadRequestException('No published version to unpublish');

      const unpublished = await tx.workflowVersion.update({
        where: { id: workflow.publishedVersion.id },
        data: { status: 'draft', publishedAt: null },
      });

      // First explicitly update the workflow's fields directly
      await tx.workflow.update({
        where: { id },
        data: {
          publishedVersionId: null,
          draftVersionId: unpublished.id,
        },
      });

      // Then update the relations to ensure consistency
      const updatedWorkflow = await tx.workflow.update({
        where: { id },
        data: {
          publishedVersion: { disconnect: true },
          draftVersion: { connect: { id: unpublished.id } },
        },
        include: { agent: true, draftVersion: true, publishedVersion: true },
      });

      return updatedWorkflow;
    });

    return this.buildWorkflowResponse(result);
  }

  /**
   * List versions for a workflow (scoped by workspace)
   */
  async listVersions(workflowId: string, workspaceId: string) {
    const wf = await this.prisma.workflow.findUnique({ where: { id: workflowId } });
    if (!wf) throw new BadRequestException('Workflow not found');
    if (wf.workspaceId !== workspaceId) {
      throw new BadRequestException('Workflow does not belong to the selected workspace');
    }

    const versions = await this.prisma.workflowVersion.findMany({
      where: { workflowId },
      orderBy: { version: 'desc' },
    });

    return versions.map((v) => ({
      id: v.id,
      version: v.version,
      status: v.status,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
      publishedAt: v.publishedAt,
    }));
  }

  /**
   * Get a specific workflow version by numeric version or tag (draft|published|live)
   */
  async getVersion(workflowId: string, versionOrTag: string, workspaceId: string) {
    const wf = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
      include: { draftVersion: true, publishedVersion: true },
    });
    if (!wf) throw new BadRequestException('Workflow not found');
    if (wf.workspaceId !== workspaceId) {
      throw new BadRequestException('Workflow does not belong to the selected workspace');
    }

    let versionRecord: any | null = null;
    if (versionOrTag === 'draft') {
      versionRecord = wf.draftVersion;
    } else if (versionOrTag === 'published' || versionOrTag === 'live') {
      versionRecord = wf.publishedVersion;
    } else {
      const num = parseInt(versionOrTag, 10);
      if (isNaN(num)) {
        throw new BadRequestException('Version must be a number or one of: draft, published');
      }
      versionRecord = await this.prisma.workflowVersion.findUnique({
        where: { workflowId_version: { workflowId, version: num } },
      });
    }

    if (!versionRecord) throw new BadRequestException('Requested version not found');

    return {
      id: versionRecord.id,
      version: versionRecord.version,
      status: versionRecord.status,
      createdAt: versionRecord.createdAt,
      updatedAt: versionRecord.updatedAt,
      publishedAt: versionRecord.publishedAt,
      workflowJson: versionRecord.workflowJson,
    };
  }

  /**
   * Delete a workflow
   */
  async deleteWorkflow(id: string) {
    return this.prisma.workflow.delete({
      where: { id },
    });
  }

  /**
   * Build API response with effective workflowJson, version, isPublished and hasDraft
   */
  private buildWorkflowResponse(workflow: any) {
    const effectiveVersion = workflow.draftVersion ?? workflow.publishedVersion ?? null;
    const isPublished = !!workflow.publishedVersionId || effectiveVersion?.status === 'published';
    
    // Check if there's a draft version that's different from the published version
    const hasDraft = !!workflow.draftVersionId && 
                    (workflow.draftVersionId !== workflow.publishedVersionId);

    return {
      ...workflow,
      workflowJson: effectiveVersion?.workflowJson ?? null,
      version: effectiveVersion?.version ?? null,
      isPublished,
      hasDraft,
    };
  }
}
