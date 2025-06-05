import { Injectable } from '@nestjs/common';
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
  constructor(private prisma: PrismaService) {}

  /**
   * Find all workflows for an agent, scoped by organizationId
   */
  async getAgentWorkflows(agentId: string, organizationId: string) {
    // Verify the agent exists and belongs to the organization
    const agent = await this.prisma.agent.findFirst({
      where: {
        id: agentId,
        organizationId
      },
    });

    if (!agent) {
      throw new Error(`Agent with ID "${agentId}" not found in organization ${organizationId}`);
    }

    const workflows = await this.prisma.workflow.findMany({
      where: { 
        agentId,
        organizationId
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
        organization: data.organizationId ? {
          connect: { id: data.organizationId }
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
    organizationId: string,
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
        organization: {
          connect: { id: organizationId }
        },
      },
    });
  }

  /**
   * Update a workflow
   */
  async updateWorkflow(id: string, data: UpdateWorkflowDto) {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id },
    });

    if (!workflow) {
      throw new Error('Workflow not found');
    }

    return this.prisma.workflow.update({
      where: { id },
      data: {
        ...data,
        nodes: data.nodes || workflow.nodes,
        edges: data.edges || workflow.edges,
      },
    });
  }

  /**
   * Publish a workflow
   */
  async publishWorkflow(id: string) {
    return this.prisma.workflow.update({
      where: { id },
      data: {
        isPublished: true,
        publishedAt: new Date(),
      },
    });
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
    return this.prisma.workflow.delete({
      where: { id },
    });
  }
}
