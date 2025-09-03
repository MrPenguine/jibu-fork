import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Agent as PrismaAgent } from '@prisma/client';
import { ExtendedAgent } from '../interfaces/agent.interface';
import { CreateAgentDto } from '../dto/create-agent.dto';
import { PrismaService } from '../../../../core/database/prisma.service';
import { UpdateAgentDto } from '../dto/update-agent.dto';
import { WorkflowService } from '../../workflow/services/workflow.service';
import { CreateWorkflowDto } from '../../workflow/dto/create-workflow.dto';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowService: WorkflowService,
  ) {}

  // Legacy no-op: assistants are removed
  private extractAssistantIdFromNodes(_: any): string | undefined {
    return undefined;
  }

  async create(createAgentDto: CreateAgentDto, workspaceId: string): Promise<ExtendedAgent> {
    this.logger.log(`Creating agent with workspace ID: ${workspaceId}`);
    this.logger.debug(`Agent data: ${JSON.stringify(createAgentDto)}`);

    if (!workspaceId) {
      this.logger.error('Workspace ID is missing in agent creation');
      throw new BadRequestException('Workspace ID is required');
    }

    try {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
      });

      if (!workspace) {
        this.logger.error(`Workspace with ID ${workspaceId} not found`);
        throw new BadRequestException(`Workspace with ID ${workspaceId} not found`);
      }

      const createData: any = {
        name: createAgentDto.name,
        description: createAgentDto.description || '',
        workspace: {
          connect: { id: workspaceId },
        },
      };

      const newAgent = await this.prisma.agent.create({
        data: createData,
        include: {
          workspace: true,
        },
      }) as unknown as ExtendedAgent;

      try {
        const agentData = newAgent as unknown as { id: string; name: string };
        this.logger.log(`Creating master workflow for agent: ${agentData.id}`);

        const workflowData: CreateWorkflowDto = {
          name: `${agentData.name} Workflow`,
          description: `Master workflow for ${agentData.name}`,
          workspaceId: workspaceId,
          assistantId: agentData.id,
        };

        const workflow = await this.workflowService.create(workflowData);
        this.logger.log(`Master workflow created successfully: ${workflow.id}`);
      } catch (workflowError) {
        this.logger.error(`Error creating master workflow: ${workflowError.message}`);
      }

      return newAgent;
    } catch (error) {
      this.logger.error(`Error creating agent: ${error.message}`);
      throw new BadRequestException(`Failed to create agent: ${error.message}`);
    }
  }

  async findAll(workspaceId: string): Promise<ExtendedAgent[]> {
    this.logger.log(`Finding all agents for workspace ID: ${workspaceId}`);

    const agents = await this.prisma.agent.findMany({
      where: {
        workspaceId: workspaceId,
      },
      include: {
        workflows: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return agents.map(agent => ({
      ...agent,
      // Derive published status from presence of a published version on any workflow
      isPublished: agent.workflows?.some((w: any) => !!w.publishedVersionId) ?? false,
    })) as unknown as ExtendedAgent[];
  }

  async findAllByAssistant(_assistantId: string, _workspaceId: string): Promise<ExtendedAgent[]> {
    // Legacy endpoint: assistants removed. Return empty list for back-compat.
    this.logger.warn('findAllByAssistant called but assistants have been removed. Returning empty list.');
    return [] as unknown as ExtendedAgent[];
  }

  async findOne(id: string, workspaceId: string): Promise<ExtendedAgent> {
    const agent = await this.prisma.agent.findFirst({
      where: {
        id,
        workspaceId,
      },
    });

    if (!agent) {
      throw new NotFoundException(`Agent with ID ${id} not found in this workspace`);
    }

    return agent as unknown as ExtendedAgent;
  }

  async update(id: string, updateAgentDto: UpdateAgentDto, workspaceId: string): Promise<ExtendedAgent> {
    if (!workspaceId) {
      throw new BadRequestException('Workspace ID is required');
    }

    await this.findOne(id, workspaceId);

    const updateData: any = {};

    // Do not persist nodes/edges/startNodeId on Agent; handled via Workflow versions

    if (updateAgentDto.name !== undefined) updateData.name = updateAgentDto.name;
    if (updateAgentDto.description !== undefined) updateData.description = updateAgentDto.description;
    // Remove legacy publish/assistant updates; those concepts no longer exist on Agent

    try {
      return this.prisma.agent.update({
        where: { id },
        data: updateData,
      }) as unknown as ExtendedAgent;
    } catch (error) {
      this.logger.error('Error updating agent:', error);
      throw new BadRequestException(`Failed to update agent: ${error.message}`);
    }
  }

  async remove(id: string, workspaceId: string): Promise<ExtendedAgent> {
    // Ensure the agent exists and belongs to the workspace
    await this.findOne(id, workspaceId);

    this.logger.log(`Deleting agent ${id} and cascading related data (workspace ${workspaceId})`);

    try {
      const deletedAgent = await this.prisma.agent.delete({
        where: { id },
      });

      this.logger.log(`Deleted agent ${id} and related data via Prisma cascade`);
      return deletedAgent as unknown as ExtendedAgent;
    } catch (error) {
      this.logger.error(`Error deleting agent ${id}: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to delete agent: ${error.message}`);
    }
  }

  async publish(id: string, workspaceId: string): Promise<ExtendedAgent> {
    try {
      this.logger.log(`Publishing agent ${id}`);
      await this.findOne(id, workspaceId);

      // No-op publish: update timestamp only; publishing handled at WorkflowVersion level elsewhere
      const updatedAgent = await this.prisma.agent.update({
        where: { id },
        data: { updatedAt: new Date() },
      });

      return updatedAgent as unknown as ExtendedAgent;
    } catch (error) {
      this.logger.error(`Error publishing agent: ${error.message}`, error.stack);
      const agent = await this.prisma.agent.findUnique({ where: { id } });
      return agent as unknown as ExtendedAgent;
    }
  }

  async unpublish(id: string, workspaceId: string): Promise<ExtendedAgent> {
    try {
      const agent = await this.findOne(id, workspaceId);
      if (!agent) {
        throw new NotFoundException(`Agent with ID "${id}" not found`);
      }

      // No-op unpublish: update timestamp only
      return this.prisma.agent.update({
        where: { id },
        data: { updatedAt: new Date() },
      }) as unknown as ExtendedAgent;
    } catch (error) {
      this.logger.error('Error unpublishing agent:', error);
      throw error;
    }
  }

  async getAgentWorkflows(agentId: string, workspaceId: string): Promise<any[]> {
    throw new Error('Method has been moved to WorkflowService');
  }

  async createSecondaryWorkflow(createSecondaryWorkflowParams: any, workspaceId: string): Promise<ExtendedAgent> {
    throw new Error('Method has been moved to WorkflowService');
  }
}
