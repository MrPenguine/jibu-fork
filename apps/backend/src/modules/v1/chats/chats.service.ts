import { Injectable, Logger } from '@nestjs/common';
import { CreateMessageDto } from './dto/create-message.dto';
import { WebhookUrlService } from '../../../core/webhook/webhook-url.service';
import { MessageQueueService } from '../../../core/services/message-queue.service';
import { PrismaService } from '../../../core/database/prisma.service';

type DiagnosticMessage = {
  id: string;
  chatId: string;
  content: string;
  role: 'assistant';
  sequenceId: number;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class ChatsService {
  private readonly logger = new Logger(ChatsService.name);
  private readonly memoryChats = new Map<string, DiagnosticMessage[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly webhookUrlService: WebhookUrlService,
    private readonly messageQueueService: MessageQueueService,
  ) {}

  private normalizeWebhookUrl(url: string | null): string | null {
    if (!url) return url;
    const parts = url.split('://');
    if (parts.length !== 2) return url;
    const [scheme, rest] = parts;
    const normalizedRest = rest.replace(/\/+/, '/').replace(/\/+/g, '/');
    return `${scheme}://${normalizedRest}`;
  }

  async getChatsByAgentId(_workspaceId: string, agentId: string) {
    this.logger.log(`[DIAGNOSTIC][ChatsService] Listing diagnostic chats for agent ${agentId}`);
    return Array.from(this.memoryChats.entries()).map(([chatId, messages]) => ({
      id: chatId,
      agentId,
      name: `Diagnostics ${chatId}`,
      sessionId: chatId,
      sessionType: 'chat',
      lastMessage: messages.at(-1)?.content ?? null,
      createdAt: messages[0]?.createdAt ?? new Date(),
      updatedAt: messages.at(-1)?.updatedAt ?? new Date(),
    }));
  }
  
  async getChatMessages(chatId: string, _workspaceId: string) {
    return this.memoryChats.get(chatId) ?? [];
  }

  async createMessage(chatId: string, message: CreateMessageDto, workspaceId: string) {
    // Resolve the workflow directly from the Chat record so we always
    // use the workflow linked in Prisma (Chat -> Workflow -> N8nWorkflow).
    this.logger.log(
      `[DIAGNOSTIC][ChatsService] Starting diagnostic createMessage for chat ${chatId} in workspace ${workspaceId}`,
    );

    const chat = await this.prisma.chat.findFirst({
      where: {
        workspaceId,
        OR: [
          { id: chatId },
          { sessionId: chatId },
        ],
      },
      include: {
        workflow: {
          include: {
            n8nWorkflow: true,
          },
        },
      },
    });

    const workflowId = chat?.workflowId || null;

    const diagnosticLines: string[] = [];
    diagnosticLines.push(`Chat ${chatId} (workspace ${workspaceId})`);

    if (!chat) {
      const msg =
        '⚠️ No Chat record found for this chatId/sessionId. Workflow cannot be resolved from schema.';
      diagnosticLines.push(msg);
      this.logger.warn(`[DIAGNOSTIC][ChatsService] ${msg}`);
    } else if (!workflowId) {
      const msg =
        `⚠️ Chat is not linked to any Workflow (chat.id=${chat.id}, sessionId=${chat.sessionId}).`;
      diagnosticLines.push(msg);
      this.logger.warn(`[DIAGNOSTIC][ChatsService] ${msg}`);
    } else {
      const wf = chat.workflow;
      const n8n = wf?.n8nWorkflow;
      const msg =
        `Linked Workflow: workflowId=${workflowId}, workflowName=${wf?.name ?? 'n/a'}, ` +
        `n8nWorkflowDbId=${n8n?.id ?? 'n/a'}, n8nWorkflowLiveId=${n8n?.n8nWorkflowId ?? 'n/a'}, ` +
        `dbWebhookUrl=${n8n?.webhookUrl ?? 'null'}`;
      diagnosticLines.push(msg);
      this.logger.log(`[DIAGNOSTIC][ChatsService] ${msg}`);
    }

    this.logger.log(
      `[DIAGNOSTIC][ChatsService] Step 1: Resolving webhook URL for workflow ${workflowId ?? 'unknown'}`,
    );

    let webhookUrl: string | null = null;
    if (workflowId) {
      webhookUrl = await this.webhookUrlService.getWebhookUrl(workflowId, false);
      webhookUrl = this.normalizeWebhookUrl(webhookUrl);
    }

    if (webhookUrl) {
      const msg = `✅ Webhook URL found: ${webhookUrl}`;
      diagnosticLines.push(msg);
      this.logger.log(`[DIAGNOSTIC][ChatsService] ${msg}`);
    } else {
      const msg = `❌ Webhook URL not found for workflow ${workflowId ?? 'unknown'}`;
      diagnosticLines.push(msg);
      this.logger.warn(`[DIAGNOSTIC][ChatsService] ${msg}`);
    }

    const payload = {
      eventType: 'message',
      sessionId: chatId,
      workflowId: workflowId ?? 'unknown',
      timestamp: Date.now(),
      text: message.content,
      metadata: message.metadata ?? {},
    };

    const payloadLog = `[DIAGNOSTIC][ChatsService] Step 2: Payload prepared -> ${JSON.stringify(payload)}`;
    diagnosticLines.push('Payload prepared (see server logs for full JSON)');
    this.logger.log(payloadLog);

    if (workflowId) {
      try {
        await this.messageQueueService.sendMessageToWorkflow(
          workflowId,
          chatId,
          message.content,
        );
        const msg = `✅ Queue enqueue succeeded for workflow ${workflowId}`;
        diagnosticLines.push(msg);
        this.logger.log(`[DIAGNOSTIC][ChatsService] ${msg}`);
      } catch (error) {
        const errMsg = `❌ Queue enqueue failed: ${(error as Error).message}`;
        diagnosticLines.push(errMsg);
        this.logger.error(
          `[DIAGNOSTIC][ChatsService] ${errMsg}`,
          (error as Error).stack,
        );
      }
    } else {
      const msg = '⚠️ Queue enqueue skipped: no workflowId provided in metadata';
      diagnosticLines.push(msg);
      this.logger.warn(`[DIAGNOSTIC][ChatsService] ${msg}`);
    }

    const diagMessage: DiagnosticMessage = {
      id: `diag-${Date.now()}`,
      chatId,
      content: diagnosticLines.join(' | '),
      role: 'assistant',
      sequenceId: message.sequenceId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const history = this.memoryChats.get(chatId) ?? [];
    history.push(diagMessage);
    this.memoryChats.set(chatId, history);

    return diagMessage;
  }
}