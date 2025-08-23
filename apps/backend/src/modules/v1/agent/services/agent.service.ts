import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Agent as PrismaAgent, WorkflowType } from '@prisma/client';
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

  private extractAssistantIdFromNodes(nodes: any): string | undefined {
    try {
      if (!nodes) return undefined;
      const parsedNodes = typeof nodes === 'string' ? JSON.parse(nodes) : nodes;
      const assistantNodes = Object.values(parsedNodes).filter(
        (node: any) => node.type === 'ASSISTANT' && node.data?.assistantId,
      );
      if (assistantNodes.length > 0) {
        const assistantId = (assistantNodes[0] as any).data?.assistantId;
        if (assistantId) {
          this.logger.log(`Found assistantId ${assistantId} in workflow nodes`);
          return assistantId;
        }
      }
      return undefined;
    } catch (error) {
      this.logger.warn(`Error extracting assistantId from nodes: ${error.message}`);
      return undefined;
    }
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

      if (createAgentDto.assistantId) {
        const assistant = await this.prisma.assistant.findFirst({
          where: {
            id: createAgentDto.assistantId,
            workspaceId,
          },
        });

        if (!assistant) {
          this.logger.error(`Assistant with ID ${createAgentDto.assistantId} not found in workspace ${workspaceId}`);
          throw new BadRequestException(`Assistant with ID ${createAgentDto.assistantId} not found in this workspace`);
        }
      }

      const createData: any = {
        name: createAgentDto.name,
        description: createAgentDto.description || '',
        workspace: {
          connect: { id: workspaceId },
        },
      };

      if (createAgentDto.assistantId) {
        createData.assistant = {
          connect: { id: createAgentDto.assistantId },
        };
      }

      const newAgent = await this.prisma.agent.create({
        data: createData,
        include: {
          assistant: true,
          workspace: true,
        },
      }) as unknown as ExtendedAgent;

      try {
        const agentData = newAgent as unknown as { id: string; name: string };
        this.logger.log(`Creating master workflow for agent: ${agentData.id}`);

        const nodes = createAgentDto.nodes || {};
        const edges = createAgentDto.edges || {};

        if (!createAgentDto.assistantId) {
          const extractedAssistantId = this.extractAssistantIdFromNodes(nodes);
          if (extractedAssistantId) {
            this.logger.log(`Extracted assistantId ${extractedAssistantId} from workflow nodes`);
            await this.prisma.agent.update({
              where: { id: newAgent.id },
              data: {
                assistant: { connect: { id: extractedAssistantId } },
              },
            });
            newAgent.assistantId = extractedAssistantId;
          }
        }

        const workflowData: CreateWorkflowDto = {
          name: `${agentData.name} Workflow`,
          description: `Master workflow for ${agentData.name}`,
          workflowJson: {
            nodes: nodes,
            edges: edges,
            startNodeId: createAgentDto.startNodeId || ''
          },
          isPublished: false,
          workspaceId: workspaceId,
        };

        const workflow = await this.workflowService.createMasterWorkflow(agentData.id, workflowData);
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
      isPublished: agent.workflows?.some(w => w.isPublished) ?? false,
    })) as unknown as ExtendedAgent[];
  }

  async findAllByAssistant(assistantId: string, workspaceId: string): Promise<ExtendedAgent[]> {
    return this.prisma.agent.findMany({
      where: {
        assistantId,
        workspaceId,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    }) as unknown as ExtendedAgent[];
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

    return agent as ExtendedAgent;
  }

  async update(id: string, updateAgentDto: UpdateAgentDto, workspaceId: string): Promise<ExtendedAgent> {
    if (!workspaceId) {
      throw new BadRequestException('Workspace ID is required');
    }

    await this.findOne(id, workspaceId);

    if (updateAgentDto.assistantId) {
      const assistant = await this.prisma.assistant.findFirst({
        where: {
          id: updateAgentDto.assistantId,
          workspaceId,
        },
      });

      if (!assistant) {
        throw new BadRequestException(`Assistant with ID ${updateAgentDto.assistantId} not found in this workspace`);
      }
    }

    const updateData: any = {};

    if (updateAgentDto.nodes !== undefined) {
      const extractedAssistantId = this.extractAssistantIdFromNodes(updateAgentDto.nodes);
      if (extractedAssistantId && updateAgentDto.assistantId === undefined) {
        updateAgentDto.assistantId = extractedAssistantId;
      }
      // Do not persist nodes on Agent; nodes belong to workflowJson on Workflow
    }

    if (updateAgentDto.name !== undefined) updateData.name = updateAgentDto.name;
    if (updateAgentDto.description !== undefined) updateData.description = updateAgentDto.description;
    // Remove legacy persistence to Agent model: edges/startNodeId are not Agent fields

    if (updateAgentDto.isPublished !== undefined) {
      updateData.isPublished = updateAgentDto.isPublished;
      if (updateAgentDto.isPublished === true) {
        updateData.publishedAt = new Date();
      }
    }

    if (updateAgentDto.assistantId !== undefined) {
      if (updateAgentDto.assistantId === null) {
        updateData.assistant = { disconnect: true };
      } else {
        updateData.assistant = { connect: { id: updateAgentDto.assistantId } };
      }
    }

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
    await this.findOne(id, workspaceId);

    return this.prisma.agent.delete({
      where: {
        id,
      },
    }) as unknown as ExtendedAgent;
  }

  async publish(id: string, workspaceId: string): Promise<ExtendedAgent> {
    try {
      this.logger.log(`Publishing agent ${id}`);
      await this.findOne(id, workspaceId);

      const updatedAgent = await this.prisma.agent.update({
        where: { id },
        data: { updatedAt: new Date() },
      });

      await this.prisma.workflow.updateMany({
        where: { agentId: id },
        data: {
          isPublished: true,
          publishedAt: new Date(),
        },
      });

      const workflow = await this.prisma.workflow.findFirst({
        where: {
          agentId: id,
          workspaceId,
        },
      });

      if (!workflow) {
        this.logger.warn(`No primary workflow found for agent ${id}.`);
      }

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
