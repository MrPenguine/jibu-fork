import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../core/database/prisma.service';
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
        agent: true,
      },
    });
  }


  /**
   * Create a new workflow (master or secondary)
   */
  async create(data: CreateWorkflowDto) {
    const { name, description, assistantId, masterWorkflowId, workspaceId } = data;

    if (masterWorkflowId) {
      // This is a secondary workflow
      const master = await this.prisma.workflow.findUnique({ where: { id: masterWorkflowId } });
      if (!master) {
        throw new Error('Master workflow not found');
      }

      return this.prisma.workflow.create({
        data: {
          name,
          description,
          isPrimary: false,
          agent: { connect: { id: assistantId } },
          workspace: { connect: { id: workspaceId } },
          // masterWorkflow: { connect: { id: masterWorkflowId } }, // If you add a direct relation
        },
      });
    } else {
      // This is a master workflow
      return this.prisma.workflow.create({
        data: {
          name,
          description,
          isPrimary: true,
          agent: { connect: { id: assistantId } },
          workspace: { connect: { id: workspaceId } },
        },
      });
    }
  }


  /**
   * Update a workflow
   */
  /**
   * Update a workflow
   */
  async updateWorkflow(id: string, data: UpdateWorkflowDto) {
    // Note: workflowJson and versioning logic will be handled separately.
    return this.prisma.workflow.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
      },
    });
  }

  /**
   * Publish a workflow
   */
  async publishWorkflow(id: string) {
    // No-op for now: return current workflow without modifying state
    this.logger.log(`publishWorkflow(${id}) called - no-op`);
    return this.prisma.workflow.findUnique({ where: { id } });
  }

  /**
   * Unpublish a workflow
   */
  async unpublishWorkflow(id: string) {
    // No-op for now: return current workflow without modifying state
    this.logger.log(`unpublishWorkflow(${id}) called - no-op`);
    return this.prisma.workflow.findUnique({ where: { id } });
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
