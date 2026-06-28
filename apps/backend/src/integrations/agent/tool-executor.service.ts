import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { google } from 'googleapis';
import { PrismaService } from '../../core/database/prisma.service';
import { CredentialService } from '../../modules/v1/credential/credential.service';

export interface ToolExecutionContext {
  workspaceId: string;
  /** User on whose behalf the tool runs. Optional for channel-initiated calls (voice/whatsapp). */
  executedById?: string | null;
}

export interface ToolExecutionResult {
  toolId: string;
  status: 'completed' | 'failed';
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
    const params = (args.query as JsonArgs) || (args.params as JsonArgs) || undefined;
    const data =
      method === 'GET' || method === 'DELETE'
        ? undefined
        : (args.body as unknown) ?? (args.data as unknown) ?? args;

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
    const apiKey = this.configService.get<string>('N8N_API_KEY');

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
}
