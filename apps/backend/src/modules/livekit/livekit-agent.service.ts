import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { ToolExecutorService } from '../../integrations/agent/tool-executor.service';

export interface VoiceAgentConfig {
  agentId: string;
  workspaceId: string;
  name: string;
  llm: { provider: string | null; model: string | null };
  systemPrompt: string;
  firstMessage: string | null;
  voice: { ttsProvider: string | null; sttProvider: string | null; voiceId: string | null };
  tools: Array<{ toolId: string; name: string; description?: string; parameters: Record<string, unknown> }>;
}

/**
 * Backend support for the LiveKit Python voice agent. Exposes the agent's config
 * (so the Python worker can configure STT/TTS/LLM/voice + tools from room
 * metadata) and a single-tool execution proxy into `ToolExecutorService`.
 */
@Injectable()
export class LiveKitAgentService {
  private readonly logger = new Logger(LiveKitAgentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly toolExecutor: ToolExecutorService,
  ) {}

  async getAgentConfig(agentId: string): Promise<VoiceAgentConfig> {
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new NotFoundException(`Agent ${agentId} not found`);

    const metadata = (agent.metadata as Record<string, unknown>) || {};
    const modelConfig = (metadata.model as Record<string, unknown>) || {};

    const tools = await this.loadToolDefs(agentId);

    return {
      agentId: agent.id,
      workspaceId: agent.workspaceId,
      name: agent.name,
      llm: {
        provider: (modelConfig.provider as string) || agent.llmProvider || null,
        model: (modelConfig.model as string) || agent.llmModel || null,
      },
      systemPrompt: (metadata.systemPrompt as string) || agent.voicemailMessage || 'You are a helpful assistant.',
      firstMessage: agent.firstMessage || null,
      voice: {
        ttsProvider: agent.ttsProvider || null,
        sttProvider: agent.sttProvider || null,
        voiceId: (metadata.voiceId as string) || null,
      },
      tools,
    };
  }

  async executeTool(
    toolId: string,
    args: Record<string, unknown>,
    workspaceId: string,
  ): Promise<unknown> {
    return this.toolExecutor.executeTool(toolId, args, { workspaceId });
  }

  /** Resolve the agent that owns an inbound (dialed) phone number for SIP. */
  async resolveAgentForNumber(dialedNumber: string): Promise<{ agentId: string; workspaceId: string } | null> {
    const agents = await this.prisma.agent.findMany({
      where: { metadata: { path: ['channels', 'voice', 'phoneNumber'], equals: dialedNumber } },
    });
    if (!agents.length) return null;
    return { agentId: agents[0].id, workspaceId: agents[0].workspaceId };
  }

  private async loadToolDefs(
    agentId: string,
  ): Promise<Array<{ name: string; description?: string; parameters: Record<string, unknown>; toolId: string }>> {
    const links = await this.prisma.agentTool.findMany({ where: { agentId }, include: { tool: true } });
    const defs: Array<{ name: string; description?: string; parameters: Record<string, unknown>; toolId: string }> = [];
    for (const link of links) {
      const tool = link.tool;
      if (!tool?.enabled) continue;
      const fn = (tool.function as Record<string, unknown>) || {};
      const name = (fn.name as string) || tool.name.replace(/[^a-zA-Z0-9_]/g, '_');
      defs.push({
        name,
        description: (fn.description as string) || tool.description || undefined,
        parameters: (fn.parameters as Record<string, unknown>) || { type: 'object', properties: {} },
        toolId: tool.id,
      });
    }
    return defs;
  }
}
