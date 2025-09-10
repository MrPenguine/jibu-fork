import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { CompileContext, InternalGraph } from 'libs/n8n-orchestrator/adapter-registry';

// Credential UI names as they appear in n8n (per user's environment)
const CREDENTIAL_NAMES = {
  openai: 'OpenAI account',
  anthropic: 'Anthropic account',
  google: 'Google Gemini(PaLM) Api account',
};

@Injectable()
export class CompileContextBuilder {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Build CompileContext and InternalGraph for a workflow within a workspace.
   * - Enforces scoping (workflow.workspaceId, assistant.agentId/workspaceId)
   * - Fetches Assistant for the Agent (most recently updated if multiple)
   * - Resolves provider credentials by name within the workspace
   * - Provides deterministic webhook info
   */
  async build(workflowId: string, workspaceId: string): Promise<{
    ctx: CompileContext;
    graph: InternalGraph;
    n8nWorkflowId?: string;
    versionLabel: string;
  }> {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id: workflowId, workspaceId },
      include: {
        agent: true,
        draftVersion: true,
        publishedVersion: true,
        n8nWorkflow: true,
      },
    });

    if (!workflow) {
      throw new NotFoundException('Workflow not found or not in workspace');
    }

    // Pick effective version: prefer draft, else published
    const version = workflow.draftVersion ?? workflow.publishedVersion;
    if (!version) {
      throw new BadRequestException('Workflow has no version to compile');
    }
    const versionLabel = String(version.version ?? 'draft');

    // Resolve provider credential by name within workspace
    const openaiCred = await this.prisma.credential.findFirst({ where: { workspaceId, name: CREDENTIAL_NAMES.openai } });
    const anthropicCred = await this.prisma.credential.findFirst({ where: { workspaceId, name: CREDENTIAL_NAMES.anthropic } });
    const googleCred = await this.prisma.credential.findFirst({ where: { workspaceId, name: CREDENTIAL_NAMES.google } });

    // Normalize/derive internal graph from stored workflowJson (if present)
    // Expecting structure: { graph: { nodes: [], edges: [] } }
    const json: any = version.workflowJson as any;
    const graph: InternalGraph = {
      nodes: Array.isArray(json?.graph?.nodes)
        ? json.graph.nodes.map((n: any) => ({ id: String(n.id), type: String(n.type || ''), data: n.data, position: n.position }))
        : [{ id: 'start', type: 'START', position: { x: 100, y: 100 }, data: { id: 'start' } }],
      edges: Array.isArray(json?.graph?.edges)
        ? json.graph.edges.map((e: any) => ({ id: e.id, source: e.source, target: e.target }))
        : [],
    };

    // Prefer the Assistant explicitly selected on the canvas
    const assistantNode = graph.nodes.find((n) => (n.type || '').toUpperCase() === 'ASSISTANT');
    let assistantIdFromGraph: string | undefined = undefined;
    if (assistantNode && assistantNode.data && typeof assistantNode.data.apiAssistantId === 'string') {
      assistantIdFromGraph = assistantNode.data.apiAssistantId;
    }

    // Load Assistant scoped to same agent and workspace, prefer explicit selection
    let assistant = null as any;
    if (assistantIdFromGraph) {
      assistant = await this.prisma.assistant.findFirst({
        where: {
          id: assistantIdFromGraph,
          agentId: workflow.agentId,
          workspaceId,
        },
      });
      if (!assistant) {
        throw new NotFoundException('Selected Assistant not found for this agent/workspace');
      }
    } else {
      assistant = await this.prisma.assistant.findFirst({
        where: { agentId: workflow.agentId, workspaceId },
        orderBy: { updatedAt: 'desc' },
      });
      if (!assistant) {
        throw new NotFoundException('No Assistant found for this agent/workspace');
      }
    }

    if (!assistant.llmProvider || !assistant.llmModel) {
      throw new BadRequestException('Assistant is missing llmProvider or llmModel');
    }

    // Read credential IDs from env (preferred), fallback to DB if missing
    const envOpenAiId = this.config.get<string>('N8N_OPENAI_CREDENTIAL_ID');
    const envAnthropicId = this.config.get<string>('N8N_ANTHROPIC_CREDENTIAL_ID');
    const envGoogleId = this.config.get<string>('N8N_GOOGLE_CREDENTIAL_ID');

    // Build CompileContext
    const ctx: CompileContext = {
      workflowName: workflow.name,
      webhook: {
        path: `/api/n8n/hooks/${workflowId}/${versionLabel}`,
        id: workflowId, // deterministic for now
      },
      assistant: {
        provider: String(assistant.llmProvider).toLowerCase() as any,
        model: String(assistant.llmModel),
        systemPrompt: assistant.systemPrompt ?? undefined,
      },
      credentials: {
        openai: (envOpenAiId || openaiCred)
          ? {
              id: envOpenAiId || openaiCred?.id!,
              name: openaiCred?.name || CREDENTIAL_NAMES.openai,
            }
          : undefined,
        anthropic: (envAnthropicId || anthropicCred)
          ? {
              id: envAnthropicId || anthropicCred?.id!,
              name: anthropicCred?.name || CREDENTIAL_NAMES.anthropic,
            }
          : undefined,
        google: (envGoogleId || googleCred)
          ? {
              id: envGoogleId || googleCred?.id!,
              name: googleCred?.name || CREDENTIAL_NAMES.google,
            }
          : undefined,
      },
    };

    return { ctx, graph, n8nWorkflowId: workflow.n8nWorkflowId ?? undefined, versionLabel };
  }
}
