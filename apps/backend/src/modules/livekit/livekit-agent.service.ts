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
    const baseSystemPrompt = (metadata.systemPrompt as string) || agent.voicemailMessage || 'You are a helpful assistant.';

    return {
      agentId: agent.id,
      workspaceId: agent.workspaceId,
      name: agent.name,
      llm: {
        provider: (modelConfig.provider as string) || agent.llmProvider || null,
        model: (modelConfig.model as string) || agent.llmModel || null,
      },
      systemPrompt: await this.appendIntentPromptSnippets(agentId, baseSystemPrompt),
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

  /**
   * Resolve the agent that owns an inbound (dialed) phone number for SIP.
   *
   * This is a defensive fallback, not the primary routing mechanism: the
   * primary path is PhoneNumberService.assignAgent() pre-seeding the SIP
   * room's metadata at admin-action time, so the Python worker resolves the
   * agent by reading room metadata on join — the same way it already does
   * for browser-originated calls — with no per-call lookup here at all. This
   * method exists for manual/debug lookups and any future webhook-driven
   * verification path, not because anything calls it on the call's critical
   * path today.
   */
  async resolveAgentForNumber(dialedNumber: string): Promise<{ agentId: string; workspaceId: string; phoneNumberId: string } | null> {
    const phoneNumber = await this.prisma.phoneNumber.findUnique({
      where: { number: dialedNumber },
      select: { id: true, agentId: true, workspaceId: true, status: true },
    });
    if (!phoneNumber?.agentId || phoneNumber.status === 'released') return null;
    return { agentId: phoneNumber.agentId, workspaceId: phoneNumber.workspaceId, phoneNumberId: phoneNumber.id };
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

  /** Same authoring-time-only Intent merge as AgentRuntimeService's version —
   * kept as a separate copy since voice config assembly is a distinct code
   * path from the text/WhatsApp turn loop, not because the logic differs. */
  private async appendIntentPromptSnippets(agentId: string, basePrompt: string): Promise<string> {
    try {
      const attached = await this.prisma.agentIntent.findMany({
        where: { agentId, intent: { enabled: true } },
        include: { intent: { select: { promptSnippet: true } } },
      });
      const snippets = attached
        .map((a) => a.intent.promptSnippet?.trim())
        .filter((s): s is string => Boolean(s));
      if (!snippets.length) return basePrompt;
      return `${basePrompt}\n\n${snippets.join('\n\n')}`;
    } catch (e) {
      this.logger.warn(`Could not load agent intents: ${(e as Error).message}`);
      return basePrompt;
    }
  }
}
