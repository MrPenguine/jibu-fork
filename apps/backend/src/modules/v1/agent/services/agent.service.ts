import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Agent as PrismaAgent } from '@prisma/client';
import { ExtendedAgent } from '../interfaces/agent.interface';
import { CreateAgentDto } from '../dto/create-agent.dto';
import { PrismaService } from '../../../../core/database/prisma.service';
import { UpdateAgentDto } from '../dto/update-agent.dto';
import { UpdateAgentConfigDto } from '../dto/update-agent-config.dto';
import { WorkflowService } from '../../workflow/services/workflow.service';
import { CreateWorkflowDto } from '../../workflow/dto/create-workflow.dto';
import { LlmProvider, TtsProvider, SttProvider } from '@prisma/client';

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
      include: {
        workflows: true,
      },
    });

    if (!agent) {
      throw new NotFoundException(`Agent with ID ${id} not found in this workspace`);
    }

    // Calculate isPublished based on whether any workflow has a publishedVersionId
    return {
      ...agent,
      isPublished: agent.workflows?.some((w: any) => !!w.publishedVersionId) ?? false,
    } as unknown as ExtendedAgent;
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

  /**
   * Return the agent's runtime config for the config form (provider/model +
   * prompt + KB/tool links + voice + channels).
   */
  async getConfig(id: string, workspaceId: string) {
    const agent = await this.prisma.agent.findFirst({
      where: { id, workspaceId },
      include: {
        tools: { select: { toolId: true } },
        knowledgeBases: { select: { knowledgeBaseId: true } },
      },
    });
    if (!agent) throw new NotFoundException(`Agent with ID ${id} not found`);

    const metadata = (agent.metadata as Record<string, any>) || {};
    const modelConfig = (metadata.model as Record<string, any>) || {};
    const channels = (metadata.channels as Record<string, boolean>) || {};

    return {
      id: agent.id,
      name: agent.name,
      description: agent.description ?? '',
      systemPrompt: metadata.systemPrompt ?? agent.voicemailMessage ?? '',
      provider: modelConfig.provider ?? agent.llmProvider ?? '',
      model: modelConfig.model ?? agent.llmModel ?? '',
      temperature: modelConfig.temperature ?? 0.7,
      maxTokens: modelConfig.maxTokens ?? 2048,
      ttsProvider: agent.ttsProvider ?? '',
      ttsVoiceId: agent.ttsVoiceId ?? '',
      sttProvider: agent.sttProvider ?? '',
      firstMessage: agent.firstMessage ?? '',
      knowledgeBaseIds: agent.knowledgeBases.map((k) => k.knowledgeBaseId),
      toolIds: agent.tools.map((t) => t.toolId),
      channels: {
        chat: channels.chat ?? true,
        whatsapp: channels.whatsapp ?? false,
        voice: channels.voice ?? false,
      },
    };
  }

  /** Persist the config form: typed columns, metadata, and KB/tool links. */
  async updateConfig(id: string, dto: UpdateAgentConfigDto, workspaceId: string) {
    const agent = await this.prisma.agent.findFirst({ where: { id, workspaceId } });
    if (!agent) throw new NotFoundException(`Agent with ID ${id} not found`);

    const metadata = (agent.metadata as Record<string, any>) || {};
    const modelConfig = (metadata.model as Record<string, any>) || {};

    if (dto.provider !== undefined) modelConfig.provider = dto.provider;
    if (dto.model !== undefined) modelConfig.model = dto.model;
    if (dto.temperature !== undefined) modelConfig.temperature = dto.temperature;
    if (dto.maxTokens !== undefined) modelConfig.maxTokens = dto.maxTokens;

    metadata.model = modelConfig;
    if (dto.systemPrompt !== undefined) metadata.systemPrompt = dto.systemPrompt;
    if (dto.channels !== undefined) {
      metadata.channels = { ...(metadata.channels || {}), ...dto.channels };
    }

    const updateData: any = { metadata };
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.firstMessage !== undefined) updateData.firstMessage = dto.firstMessage;
    if (dto.ttsVoiceId !== undefined) updateData.ttsVoiceId = dto.ttsVoiceId;

    const llmEnum = this.toEnum(LlmProvider, dto.provider);
    if (llmEnum) updateData.llmProvider = llmEnum;
    if (dto.model !== undefined) updateData.llmModel = dto.model;
    const ttsEnum = this.toEnum(TtsProvider, dto.ttsProvider);
    if (ttsEnum) updateData.ttsProvider = ttsEnum;
    const sttEnum = this.toEnum(SttProvider, dto.sttProvider);
    if (sttEnum) updateData.sttProvider = sttEnum;

    await this.prisma.$transaction(async (tx) => {
      await tx.agent.update({ where: { id }, data: updateData });

      if (dto.toolIds !== undefined) {
        await tx.agentTool.deleteMany({ where: { agentId: id } });
        if (dto.toolIds.length) {
          await tx.agentTool.createMany({
            data: dto.toolIds.map((toolId) => ({ agentId: id, toolId })),
            skipDuplicates: true,
          });
        }
      }

      if (dto.knowledgeBaseIds !== undefined) {
        await tx.agentKnowledgeBase.deleteMany({ where: { agentId: id } });
        if (dto.knowledgeBaseIds.length) {
          await tx.agentKnowledgeBase.createMany({
            data: dto.knowledgeBaseIds.map((knowledgeBaseId) => ({ agentId: id, knowledgeBaseId })),
            skipDuplicates: true,
          });
        }
      }
    });

    return this.getConfig(id, workspaceId);
  }

  /** List the knowledge bases linked to an agent (full KB records). */
  async listAgentKnowledgeBases(agentId: string, workspaceId: string) {
    await this.findOne(agentId, workspaceId);
    const links = await this.prisma.agentKnowledgeBase.findMany({
      where: { agentId },
      include: { knowledgeBase: true },
    });
    return links
      .map((l) => l.knowledgeBase)
      .filter((kb) => kb && kb.workspaceId === workspaceId);
  }

  /** Link a knowledge base to an agent (idempotent). */
  async linkAgentKnowledgeBase(agentId: string, knowledgeBaseId: string, workspaceId: string) {
    await this.findOne(agentId, workspaceId);
    const kb = await this.prisma.knowledgeBase.findFirst({
      where: { id: knowledgeBaseId, workspaceId },
    });
    if (!kb) {
      throw new NotFoundException(`Knowledge base ${knowledgeBaseId} not found in this workspace`);
    }
    await this.prisma.agentKnowledgeBase.upsert({
      where: { agentId_knowledgeBaseId: { agentId, knowledgeBaseId } },
      create: { agentId, knowledgeBaseId },
      update: {},
    });
    return this.listAgentKnowledgeBases(agentId, workspaceId);
  }

  /** Unlink a knowledge base from an agent. */
  async unlinkAgentKnowledgeBase(agentId: string, knowledgeBaseId: string, workspaceId: string) {
    await this.findOne(agentId, workspaceId);
    await this.prisma.agentKnowledgeBase.deleteMany({ where: { agentId, knowledgeBaseId } });
    return this.listAgentKnowledgeBases(agentId, workspaceId);
  }

  /** List the workspace's tools for the config-form multi-select. */
  async listWorkspaceTools(workspaceId: string) {
    return this.prisma.tool.findMany({
      where: { workspaceId },
      select: { id: true, name: true, description: true, type: true, enabled: true },
      orderBy: { name: 'asc' },
    });
  }

  private toEnum<T extends Record<string, string>>(enumObj: T, value?: string): T[keyof T] | undefined {
    if (!value) return undefined;
    const upper = value.toUpperCase();
    return (Object.values(enumObj) as string[]).includes(upper)
      ? (upper as T[keyof T])
      : undefined;
  }

  async getAgentWorkflows(agentId: string, workspaceId: string): Promise<any[]> {
    throw new Error('Method has been moved to WorkflowService');
  }

  async createSecondaryWorkflow(createSecondaryWorkflowParams: any, workspaceId: string): Promise<ExtendedAgent> {
    throw new Error('Method has been moved to WorkflowService');
  }
}
