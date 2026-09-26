import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { google } from 'googleapis';
import { PrismaService } from '../../core/database/prisma.service';
import { ProviderCredentialsResolver } from '../../core/provider-credentials/provider-credentials.resolver';
import { CredentialService } from '../../modules/v1/credential/credential.service';

export interface ToolExecutionContext {
  workspaceId: string;
  /** User on whose behalf the tool runs. Optional for channel-initiated calls (voice/whatsapp). */
  executedById?: string | null;
  /** Chat id — needed to track pending confirmations for Tool.requiresConfirmation.
   * Omitted callers (e.g. voice, which doesn't route through a Chat row today)
   * just never get the confirmation gate — see executeTool's early-return. */
  sessionId?: string;
}

export interface ToolExecutionResult {
  toolId: string;
  status: 'completed' | 'failed' | 'confirmation_required';
  output?: unknown;
  error?: string;
}

type JsonArgs = Record<string, unknown>;

/**
 * Executes a workspace `Tool` as a function-call requested by the LLM brain.
 *
 * This is the ONLY place tools are executed. The conversation brain
 * (`AgentRuntimeService`) decides *when* to call a tool; this service decides
 * *how*. n8n is reached here strictly as a per-tool integration backend, never
 * as the conversational brain.
 *
 * Supported tool `type` families:
 *  - `http.request` / `http.*`        -> generic outbound HTTP request
 *  - `google.calendar.*`              -> Google Calendar via OAuth
 *  - `n8n.*` (or metadata.n8nWorkflowId) -> trigger a single n8n workflow
 */
@Injectable()
export class ToolExecutorService {
  private readonly logger = new Logger(ToolExecutorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly credentialService: CredentialService,
    private readonly providerCredentials: ProviderCredentialsResolver,
  ) {}

  async executeTool(
    toolId: string,
    args: JsonArgs,
    context: ToolExecutionContext,
  ): Promise<ToolExecutionResult> {
    const tool = await this.prisma.tool.findUnique({ where: { id: toolId } });

    if (!tool || tool.workspaceId !== context.workspaceId) {
      return { toolId, status: 'failed', error: 'Tool not found in workspace' };
    }
    if (!tool.enabled) {
      return { toolId, status: 'failed', error: 'Tool is disabled' };
    }

    if (tool.requiresConfirmation && context.sessionId) {
      const gate = await this.checkConfirmationGate(context.sessionId, toolId);
      if (!gate.confirmed) {
        return {
          toolId,
          status: 'confirmation_required',
          output: {
            message:
              'This action requires the user\'s explicit confirmation before it runs. Restate exactly what you are about to do (using the arguments you were given) and ask the user to confirm. Do not call this tool again until they have replied affirmatively in a later message.',
          },
        };
      }
    }

    const execution = await this.prisma.toolExecution.create({
      data: {
        toolId: tool.id,
        status: 'running',
        input: args as object,
        executedById: context.executedById ?? null,
      },
    });

    try {
      const metadata = (tool.metadata as JsonArgs) || {};
      const type = (tool.type || '').toLowerCase();

      let secret: Record<string, unknown> | null = null;
      if (tool.credentialId) {
        try {
          const cred = await this.credentialService.getCredential(
            tool.credentialId,
            context.workspaceId,
            context.executedById ?? '',
          );
          secret = (cred?.secret as Record<string, unknown>) ?? null;
        } catch (e) {
          this.logger.warn(`Could not load credential ${tool.credentialId}: ${(e as Error).message}`);
        }
      }

      let output: unknown;
      if (type.startsWith('google.calendar')) {
        output = await this.executeGoogleCalendar(type, args, metadata, secret);
      } else if (type.startsWith('n8n') || metadata.n8nWorkflowId) {
        output = await this.executeN8nWorkflow(args, metadata);
      } else if (type.startsWith('http')) {
        output = await this.executeHttpRequest(args, metadata);
      } else {
        throw new Error(`Unsupported tool type: ${tool.type}`);
      }

      await this.prisma.toolExecution.update({
        where: { id: execution.id },
        data: { status: 'completed', output: output as object, completedAt: new Date() },
      });

      return { toolId, status: 'completed', output };
    } catch (error) {
      const message = (error as Error).message;
      this.logger.error(`Tool ${toolId} execution failed: ${message}`);
      await this.prisma.toolExecution.update({
        where: { id: execution.id },
        data: { status: 'failed', errorMessage: message, completedAt: new Date() },
      });
      return { toolId, status: 'failed', error: message };
    }
  }

  /**
   * Generic HTTP request tool. URL/method/headers come from tool metadata;
   * the LLM-provided args supply query params / body / path substitutions.
   */
  private async executeHttpRequest(args: JsonArgs, metadata: JsonArgs): Promise<unknown> {
    const method = ((args.method as string) || (metadata.method as string) || 'GET').toUpperCase();
    let url = (args.url as string) || (metadata.url as string);
    if (!url) {
      throw new Error('http tool requires a "url" in metadata or arguments');
    }

    // Substitute {placeholders} in the URL from args.
    url = url.replace(/\{(\w+)\}/g, (_m, key) =>
      args[key] != null ? encodeURIComponent(String(args[key])) : `{${key}}`,
    );

    const headers = {
      ...((metadata.headers as Record<string, string>) || {}),
      ...((args.headers as Record<string, string>) || {}),
    };
    // A tool's function schema almost always declares its parameters flat
    // (e.g. { school_id, query }, not { query: { school_id, query } }) —
    // that's how LLM function-calling schemas are conventionally written.
    // For GET/DELETE, default to using the LLM's actual arguments as the
    // query string; args.query/args.params/args.body/args.data stay
    // supported as an OPT-IN nested-object override for a tool that
    // deliberately nests them, but are never required.
    //
    // Bug fixed here: "query"/"params"/"body"/"data" are also extremely
    // common flat LLM-schema parameter names in their own right (e.g.
    // lookup_student's own "query" arg = "admission number or name"). The
    // old code treated ANY truthy args.query as the nested override —
    // including a plain string — and handed that string to axios as
    // `params`, which crashes deep in axios's URL-serializer with "target
    // must be an object" (reproduced live: lookup_student's tool call was
    // silently failing on every call because of this). Only a genuine
    // plain-object value now counts as the nested override; a flat
    // string/number arg named "query" correctly flows through flatArgs
    // instead of being swallowed as framing.
    const isPlainObject = (v: unknown): v is JsonArgs =>
      typeof v === 'object' && v !== null && !Array.isArray(v);
    const nestedQuery = isPlainObject(args.query) ? (args.query as JsonArgs) : undefined;
    const nestedParams = isPlainObject(args.params) ? (args.params as JsonArgs) : undefined;
    const nestedBody = isPlainObject(args.body) ? (args.body as JsonArgs) : undefined;
    const nestedData = isPlainObject(args.data) ? (args.data as JsonArgs) : undefined;

    const CONTROL_KEYS = new Set(['url', 'method', 'headers']);
    const consumedAsNested = new Set<string>(
      [
        nestedQuery && 'query',
        nestedParams && 'params',
        nestedBody && 'body',
        nestedData && 'data',
      ].filter(Boolean) as string[],
    );
    const isGetLike = method === 'GET' || method === 'DELETE';
    const flatArgs = Object.fromEntries(
      Object.entries(args).filter(([k]) => !CONTROL_KEYS.has(k) && !consumedAsNested.has(k)),
    );
    const params = nestedQuery || nestedParams || (isGetLike && Object.keys(flatArgs).length ? flatArgs : undefined);
    const data = isGetLike ? undefined : nestedBody || nestedData || args;

    const response = await firstValueFrom(
      this.httpService.request({ method, url, headers, params, data, timeout: 20000 }),
    );
    return { status: response.status, data: response.data };
  }

  /**
   * Google Calendar tool. Uses workspace OAuth client (env) plus a stored
   * refresh token (credential secret or metadata) to act on the user's calendar.
   */
  private async executeGoogleCalendar(
    type: string,
    args: JsonArgs,
    metadata: JsonArgs,
    secret: Record<string, unknown> | null,
  ): Promise<unknown> {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    const redirectUri = this.configService.get<string>('GOOGLE_REDIRECT_URI');
    const refreshToken =
      (secret?.refresh_token as string) ||
      (secret?.refreshToken as string) ||
      (metadata.refreshToken as string);

    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth client is not configured (GOOGLE_CLIENT_ID/SECRET)');
    }
    if (!refreshToken) {
      throw new Error('No Google refresh token available for this tool credential');
    }

    const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    oauth2.setCredentials({ refresh_token: refreshToken });
    const calendar = google.calendar({ version: 'v3', auth: oauth2 });
    const calendarId = (args.calendarId as string) || (metadata.calendarId as string) || 'primary';

    if (type.includes('availability') || type.includes('freebusy') || type.includes('list')) {
      const timeMin = (args.startTime as string) || (args.timeMin as string) || new Date().toISOString();
      const timeMax =
        (args.endTime as string) ||
        (args.timeMax as string) ||
        new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const res = await calendar.events.list({
        calendarId,
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: 'startTime',
      });
      const events = res.data.items || [];
      return { available: events.length === 0, events };
    }

    // Default: create an event.
    const res = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: (args.title as string) || (args.summary as string) || 'New event',
        description: args.description as string,
        start: { dateTime: args.startTime as string, timeZone: (args.timeZone as string) || 'UTC' },
        end: { dateTime: args.endTime as string, timeZone: (args.timeZone as string) || 'UTC' },
        attendees: Array.isArray(args.attendees)
          ? (args.attendees as string[]).map((email) => ({ email }))
          : undefined,
      },
    });
    return res.data;
  }

  /**
   * Trigger a single n8n workflow as a tool backend (NOT the conversation brain).
   * The workflow id/webhook comes from tool metadata; args become the payload.
   */
  private async executeN8nWorkflow(args: JsonArgs, metadata: JsonArgs): Promise<unknown> {
    const baseUrl =
      this.configService.get<string>('N8N_WEBHOOK_BASE_URL') ||
      this.configService.get<string>('N8N_BASE_URL') ||
      this.configService.get<string>('N8N_URL');
    const apiKey = await this.providerCredentials.getSecret('n8n');

    const webhookUrl = metadata.webhookUrl as string;
    const workflowId = metadata.n8nWorkflowId as string;
    const url = webhookUrl || (workflowId && baseUrl ? `${baseUrl}/${workflowId}` : undefined);

    if (!url) {
      throw new Error('n8n tool requires metadata.webhookUrl or metadata.n8nWorkflowId');
    }

    const response = await firstValueFrom(
      this.httpService.post(url, args, {
        headers: apiKey ? { 'X-N8N-API-KEY': apiKey } : {},
        timeout: 30000,
      }),
    );
    return { status: response.status, data: response.data };
  }

  /**
   * Two-turn confirmation gate for Tool.requiresConfirmation. First time a
   * given tool is called in a chat, mark it pending and refuse to execute
   * (the caller gets a `confirmation_required` result to relay to the user).
   * If it's called again in a later turn (meaning the user had a chance to
   * respond in between), the pending marker already exists — clear it and
   * let this call through.
   *
   * This is a pragmatic MVP gate: it confirms "this was asked about before,
   * in a prior turn," not "the user definitely said yes" — the system
   * prompt instructs the model to only re-call after an explicit yes, and
   * this backstops same-turn silent execution, which was the actual bug.
   * Scoped to Chat.metadata — voice sessions (no Chat row today) skip the
   * gate entirely rather than block on it, per executeTool's `sessionId`
   * check above.
   */
  private async checkConfirmationGate(sessionId: string, toolId: string): Promise<{ confirmed: boolean }> {
    const chat = await this.prisma.chat.findUnique({ where: { id: sessionId }, select: { metadata: true } });
    if (!chat) return { confirmed: false };

    const metadata = (chat.metadata as Record<string, unknown>) || {};
    const pending = (metadata.pendingConfirmations as Record<string, boolean>) || {};

    if (pending[toolId]) {
      delete pending[toolId];
      await this.prisma.chat.update({
        where: { id: sessionId },
        data: { metadata: { ...metadata, pendingConfirmations: pending } },
      });
      return { confirmed: true };
    }

    await this.prisma.chat.update({
      where: { id: sessionId },
      data: { metadata: { ...metadata, pendingConfirmations: { ...pending, [toolId]: true } } },
    });
    return { confirmed: false };
  }
}
