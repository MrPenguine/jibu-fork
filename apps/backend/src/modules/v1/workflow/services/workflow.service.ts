import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../core/database/prisma.service';

// Define WorkflowType locally until Prisma client is regenerated properly
export enum WorkflowType {
  MASTER = 'MASTER',
  SECONDARY = 'SECONDARY'
}
import { CreateWorkflowDto } from '../dto/create-workflow.dto';
import { UpdateWorkflowDto } from '../dto/update-workflow.dto';
import { CreateSecondaryWorkflowDto } from '../dto/create-secondary-workflow.dto';

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
      include: {
        masterWorkflow: {
          select: {
            id: true,
            name: true,
          },
        },
        secondaryWorkflows: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return workflows;
  }

  /**
   * Find a workflow by ID
   */
  async findById(id: string) {
    return this.prisma.workflow.findUnique({
      where: { id },
      include: {
        masterWorkflow: true,
        secondaryWorkflows: true,
        agent: true,
      },
    });
  }

  /**
   * Get master workflow for an agent
   */
  async getMasterWorkflow(agentId: string) {
    return this.prisma.workflow.findFirst({
      where: {
        agentId,
        workflowType: WorkflowType.MASTER,
      },
    });
  }

  /**
   * Create a new master workflow for an agent
   */
  async createMasterWorkflow(agentId: string, data: CreateWorkflowDto) {
    return this.prisma.workflow.create({
      data: {
        name: data.name,
        description: data.description,
        workflowType: WorkflowType.MASTER,
        nodes: data.nodes || {},
        edges: data.edges || {},
        startNodeId: data.startNodeId,
        isPublished: data.isPublished || false,
        agent: {
          connect: { id: agentId }
        },
        workspace: data.workspaceId ? {
          connect: { id: data.workspaceId }
        } : undefined,
      },
    });
  }

  /**
   * Create a secondary workflow
   */
  async createSecondaryWorkflow(
    masterWorkflowId: string,
    data: CreateSecondaryWorkflowDto,
    agentId: string,
    workspaceId: string,
  ) {
    const masterWorkflow = await this.prisma.workflow.findUnique({
      where: { id: masterWorkflowId },
    });

    if (!masterWorkflow) {
      throw new Error('Master workflow not found');
    }

    // Validate that the master workflow is actually a master workflow
    if (masterWorkflow.workflowType !== WorkflowType.MASTER) {
      throw new Error('Cannot create a secondary workflow under a non-master workflow');
    }

    return this.prisma.workflow.create({
      data: {
        name: data.name,
        description: data.description,
        nodes: data.nodes || masterWorkflow.nodes,  // Default to master workflow nodes
        edges: data.edges || masterWorkflow.edges,  // Default to master workflow edges
        startNodeId: data.startNodeId,
        workflowType: WorkflowType.SECONDARY,
        masterWorkflow: {
          connect: { id: masterWorkflowId }
        },
        agent: {
          connect: { id: agentId }
        },
        workspace: {
          connect: { id: workspaceId }
        },
      },
    });
  }

  /**
   * Update a workflow
   */
  async updateWorkflow(id: string, data: UpdateWorkflowDto) {
    return this.prisma.workflow.upsert({
      where: { id },
      update: {
        name: data.name,
        description: data.description,
        nodes: data.nodes,
        edges: data.edges,
        startNodeId: data.startNodeId,
        isPublished: data.isPublished,
      },
      create: {
        id,
        name: data.name || 'Untitled Workflow',
        description: data.description,
        nodes: data.nodes || {},
        edges: data.edges || {},
        startNodeId: data.startNodeId,
        isPublished: data.isPublished || false,
        workflowType: WorkflowType.MASTER, // Default to MASTER
        agent: {
          connect: { id: data.agentId },
        },
        workspace: {
          connect: { id: data.workspaceId },
        },
      },
    });
  }

  /**
   * Publish a workflow
   */
  async publishWorkflow(id: string) {
    const publishedWorkflow = await this.prisma.workflow.update({
      where: { id },
      data: {
        isPublished: true,
        publishedAt: new Date(),
      }
    });

    // N8N synchronization has been removed

    return publishedWorkflow;
  }

  /**
   * Unpublish a workflow
   */
  async unpublishWorkflow(id: string) {
    return this.prisma.workflow.update({
      where: { id },
      data: {
        isPublished: false,
        publishedAt: null,
      },
    });
  }

  /**
   * Delete a workflow
   */
  async deleteWorkflow(id: string) {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id },
    });

    if (!workflow) {
      throw new Error('Workflow not found');
    }

    // N8N workflow deletion has been removed

    return this.prisma.workflow.delete({
      where: { id },
    });
  }
}
