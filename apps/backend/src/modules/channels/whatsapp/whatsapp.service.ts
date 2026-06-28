import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../../../core/database/prisma.service';
import { AgentRuntimeService } from '../../../integrations/agent/agent-runtime.service';

interface WhatsAppInboundMessage {
  from: string;
  id: string;
  type: string;
  text?: { body: string };
}

interface WhatsAppValue {
  metadata?: { phone_number_id?: string; display_phone_number?: string };
  messages?: WhatsAppInboundMessage[];
}

export interface WhatsAppWebhookBody {
  object?: string;
  entry?: Array<{ changes?: Array<{ value?: WhatsAppValue }> }>;
}

/**
 * WhatsApp Cloud API (Meta Graph API) channel.
 *
 * Inbound messages are answered by the SAME single-brain runtime used by web
 * chat and voice — only the transport differs. The agent serving a given
 * WhatsApp number is resolved from agent metadata
 * (`metadata.channels.whatsapp.phoneNumberId`) with an env-var fallback.
 */
@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly graphVersion = 'v21.0';

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
    private readonly agentRuntime: AgentRuntimeService,
  ) {}

  verifyWebhook(mode: string, token: string, challenge: string): string {
    const verifyToken = this.configService.get<string>('WHATSAPP_VERIFY_TOKEN');
    if (mode === 'subscribe' && token && token === verifyToken) {
      this.logger.log('WhatsApp webhook verified');
      return challenge;
    }
    this.logger.warn('WhatsApp webhook verification failed');
    throw new Error('Verification failed');
  }

  async handleInbound(body: WhatsAppWebhookBody): Promise<void> {
    const changes = body.entry?.flatMap((e) => e.changes || []) || [];
    for (const change of changes) {
      const value = change.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      const messages = value?.messages || [];
      for (const msg of messages) {
        if (msg.type !== 'text' || !msg.text?.body) continue;
        try {
          await this.processMessage(phoneNumberId, msg.from, msg.text.body);
        } catch (e) {
          this.logger.error(`Failed to process WhatsApp message: ${(e as Error).message}`);
        }
      }
    }
  }

  private async processMessage(phoneNumberId: string | undefined, from: string, text: string): Promise<void> {
    const agent = await this.resolveAgent(phoneNumberId);
    if (!agent) {
      this.logger.warn(`No agent resolved for WhatsApp number ${phoneNumberId}; dropping message`);
      return;
    }

    const sessionId = `whatsapp:+${from.replace(/^\+/, '')}`;
    const chat = await this.ensureChat(agent.id, agent.workspaceId, sessionId);

    const result = await this.agentRuntime.runTurn({
      agentId: agent.id,
      channel: 'whatsapp',
      sessionId: chat.id,
      input: text,
      workspaceId: agent.workspaceId,
      persist: true,
    });

    await this.sendMessage(phoneNumberId, from, result.output);
  }

  /** Resolve the agent that owns a WhatsApp phone number id. */
  private async resolveAgent(phoneNumberId: string | undefined) {
    if (phoneNumberId) {
      const agents = await this.prisma.agent.findMany({
        where: { metadata: { path: ['channels', 'whatsapp', 'phoneNumberId'], equals: phoneNumberId } },
      });
      if (agents.length) return agents[0];
    }
    const defaultAgentId = this.configService.get<string>('WHATSAPP_DEFAULT_AGENT_ID');
    if (defaultAgentId) {
      return this.prisma.agent.findUnique({ where: { id: defaultAgentId } });
    }
    return null;
  }

  private async ensureChat(agentId: string, workspaceId: string, sessionId: string) {
    const existing = await this.prisma.chat.findFirst({ where: { workspaceId, agentId, sessionId } });
    if (existing) return existing;
    return this.prisma.chat.create({
      data: { workspaceId, agentId, sessionId, sessionType: 'whatsapp', name: sessionId },
    });
  }

  private async sendMessage(phoneNumberId: string | undefined, to: string, text: string): Promise<void> {
    const accessToken = this.configService.get<string>('WHATSAPP_ACCESS_TOKEN');
    const numberId = phoneNumberId || this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID');
    if (!accessToken || !numberId) {
      this.logger.error('WHATSAPP_ACCESS_TOKEN or phone number id missing; cannot send reply');
      return;
    }
    const url = `https://graph.facebook.com/${this.graphVersion}/${numberId}/messages`;
    await firstValueFrom(
      this.httpService.post(
        url,
        { messaging_product: 'whatsapp', to, type: 'text', text: { body: text } },
        { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } },
      ),
    );
  }
}
