import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CreateAssistantDto } from './dto/create-assistant.dto';
import { UpdateAssistantDto } from './dto/update-assistant.dto';

@Injectable()
export class AssistantService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeLlmProvider(value?: string | null): any | undefined {
    if (!value) return undefined;
    const v = value.toString().toUpperCase();
    // Map common aliases
    const map: Record<string, string> = {
      'OPENAI': 'OPENAI',
      'ANTHROPIC': 'ANTHROPIC',
      'AZURE_OPENAI': 'AZURE_OPENAI',
      'AZURE-OPENAI': 'AZURE_OPENAI',
      'AZUREOPENAI': 'AZURE_OPENAI',
      'GOOGLE': 'GOOGLE',
      'GCP': 'GOOGLE',
      'CUSTOM': 'CUSTOM',
    };
    return (map[v] ?? v) as any; // Let Prisma validate unknowns
  }

  async findAll(workspaceId: string, agentId?: string) {
    return this.prisma.assistant.findMany({
      where: {
        workspaceId,
        ...(agentId ? { agentId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, workspaceId: string) {
    return this.prisma.assistant.findFirst({ where: { id, workspaceId } });
  }

  async create(dto: CreateAssistantDto) {
    // Validate agent belongs to workspace
    const agent = await this.prisma.agent.findFirst({
      where: { id: dto.agentId, workspaceId: dto.workspaceId },
      select: { id: true },
    });
    if (!agent) {
      throw new BadRequestException('Invalid agentId or agent does not belong to workspace');
    }

    // Enforce unique name per agent
    const existing = await this.prisma.assistant.findFirst({
      where: { agentId: dto.agentId, name: dto.name },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException('Assistant with this name already exists for the agent');
    }

    return this.prisma.assistant.create({
      data: {
        agentId: dto.agentId,
        workspaceId: dto.workspaceId,
        name: dto.name,
        description: dto.description,
        llmProvider: this.normalizeLlmProvider(dto.llmProvider as any),
        llmModel: dto.llmModel,
        voiceId: dto.voiceId,
        sttModel: dto.sttModel,
        hipaaEnabled: dto.hipaaEnabled ?? false,
        systemPrompt: dto.systemPrompt,
        metadata: dto.metadata as any,
      },
    });
  }

  async update(id: string, workspaceId: string, dto: UpdateAssistantDto) {
    const assistant = await this.prisma.assistant.findFirst({ where: { id, workspaceId } });
    if (!assistant) throw new NotFoundException('Assistant not found');

    // If agentId is being changed, validate ownership remains in same workspace
    if (dto.agentId && dto.agentId !== assistant.agentId) {
      const agent = await this.prisma.agent.findFirst({
        where: { id: dto.agentId, workspaceId },
        select: { id: true },
      });
      if (!agent) throw new BadRequestException('New agentId is invalid for this workspace');
    }

    // If name changes, enforce unique per agent
    if (dto.name) {
      const conflict = await this.prisma.assistant.findFirst({
        where: { agentId: dto.agentId || assistant.agentId, name: dto.name, NOT: { id } },
        select: { id: true },
      });
      if (conflict) throw new BadRequestException('Assistant name already exists for the agent');
    }

    return this.prisma.assistant.update({
      where: { id },
      data: {
        agentId: dto.agentId,
        name: dto.name,
        description: dto.description,
        llmProvider: this.normalizeLlmProvider(dto.llmProvider as any),
        llmModel: dto.llmModel,
        voiceId: dto.voiceId,
        sttModel: dto.sttModel,
        hipaaEnabled: dto.hipaaEnabled,
        systemPrompt: dto.systemPrompt,
        metadata: dto.metadata as any,
      },
    });
  }

  async remove(id: string, workspaceId: string) {
    const assistant = await this.prisma.assistant.findFirst({ where: { id, workspaceId } });
    if (!assistant) throw new NotFoundException('Assistant not found');

    return this.prisma.assistant.delete({ where: { id } });
  }
}
