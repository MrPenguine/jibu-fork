import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { CreateMessageDto } from './dto/create-message.dto';
import { WebhookUrlService } from '../../../core/webhook/webhook-url.service';
import { MessageQueueService } from '../../../core/services/message-queue.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { PayloadBuilderService } from '@jibu/payload-builder';
import { AgentRuntimeService } from '../../../integrations/agent/agent-runtime.service';

export interface CreateMessageOptions {
  /**
   * When true (default), a user turn on an agent-backed chat is answered by the
   * single-brain runtime and the reply is persisted. Internal persistence-only
   * callers (e.g. AgentController saving messages) pass false to avoid a second
   * brain run.
   */
  generateReply?: boolean;
}

@Injectable()
export class ChatsService {
  private readonly logger = new Logger(ChatsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly webhookUrlService: WebhookUrlService,
    private readonly messageQueueService: MessageQueueService,
    private readonly payloadBuilder: PayloadBuilderService,
    private readonly agentRuntime: AgentRuntimeService,
  ) {}

  private normalizeWebhookUrl(url: string | null): string | null {
    if (!url) return url;
    const parts = url.split('://');
    if (parts.length !== 2) return url;
    const [scheme, rest] = parts;
    const normalizedRest = rest.replace(/\/+/, '/').replace(/\/+/g, '/');
    return `${scheme}://${normalizedRest}`;
  }

  async getChatsByAgentId(workspaceId: string, agentId: string) {
    this.logger.log(`[DIAGNOSTIC][ChatsService] Listing chats for agent ${agentId} in workspace ${workspaceId}`);

    const chats = await this.prisma.chat.findMany({
      where: { workspaceId, agentId },
      include: {
        messages: {
          orderBy: { sequenceId: 'asc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return chats.map((chat) => ({
      id: chat.id,
      agentId: chat.agentId,
      name: chat.name ?? `Chat ${chat.sessionId}`,
      sessionId: chat.sessionId,
      sessionType: chat.sessionType,
      lastMessage: chat.messages.at(-1)?.content ?? null,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    }));
  }

  async getChatMessages(chatId: string, workspaceId: string) {
    const chat = await this.prisma.chat.findFirst({
      where: {
        workspaceId,
        OR: [
          { id: chatId },
          { sessionId: chatId },
        ],
      },
      include: {
        messages: {
          orderBy: { sequenceId: 'asc' },
        },
      },
    });

    return chat?.messages ?? [];
  }

  async createMessage(
    chatId: string,
    message: CreateMessageDto,
    workspaceId: string,
    options: CreateMessageOptions = {},
  ) {
    const generateReply = options.generateReply ?? true;
    // Resolve the workflow directly from the Chat record so we always
    // use the workflow linked in Prisma (Chat -> Workflow -> N8nWorkflow).
    this.logger.log(
      `[DIAGNOSTIC][ChatsService] Starting createMessage for chat ${chatId} in workspace ${workspaceId}`,
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

    if (!chat) {
      const msg =
        '⚠️ No Chat record found for this chatId/sessionId. Workflow cannot be resolved from schema.';
      this.logger.warn(`[DIAGNOSTIC][ChatsService] ${msg}`);
      throw new BadRequestException(msg);
    }

    const workflowId = chat.workflowId || null;
    const agentId = chat.agentId || null;
    const sessionId = chat.sessionId || chatId;

    // Persist the message to the database
    const createdMessage = await this.prisma.message.create({
      data: {
        chatId: chat.id,
        content: message.content,
        role: message.role,
        type: message.type ?? 'text',
        sequenceId: message.sequenceId,
        metadata: message.metadata as any,
      },
    });

    this.logger.log(
      `[DIAGNOSTIC][ChatsService] Message persisted to DB for chat ${chat.id} with agentId=${agentId ?? 'none'} workflowId=${workflowId ?? 'unknown'}`,
    );

    // Persistence-only callers (or non-user turns) stop here.
    if (!generateReply || message.role !== 'user') {
      return createdMessage;
    }

    // Single-brain path: an agent-backed chat is answered directly by the runtime.
    if (agentId) {
      try {
        const result = await this.agentRuntime.runTurn({
          agentId,
          channel: 'chat',
          sessionId: chat.id,
          input: message.content,
          workspaceId,
        });

        const assistantMessage = await this.prisma.message.create({
          data: {
            chatId: chat.id,
            content: result.output,
            role: 'assistant',
            type: 'text',
            sequenceId: (message.sequenceId ?? 0) + 1,
            metadata: result.meta as any,
          },
        });

        this.logger.log(
          `[ChatsService] ✅ Single-brain reply generated for agent ${agentId}, chat ${chat.id}`,
        );
        return { ...createdMessage, assistantMessage };
      } catch (error) {
        this.logger.error(
          `[ChatsService] ❌ Single-brain runTurn failed for agent ${agentId}: ${(error as Error).message}`,
          (error as Error).stack,
        );
        return createdMessage;
      }
    }

    if (workflowId) {
      try {
        // Build canonical payload and enqueue to n8n via WEBHOOK_DELIVERY queue — identical path as voice
        const payload = await this.payloadBuilder.buildMessagePayload({
          workflowId,
          sessionId,
          text: message.content,
          isVoice: false,
          extra: {
            workspaceId,
            chatId: chat.id,
          },
        });

        await this.messageQueueService.sendMessageToWorkflow(
          workflowId,
          sessionId,
          message.content,
          undefined,
          undefined,
          payload,
        );

        this.logger.log(
          `[DIAGNOSTIC][ChatsService] ✅ Queue enqueue succeeded for workflow ${workflowId} and chat ${chat.id}`,
        );
      } catch (error) {
        const errMsg = `❌ Queue enqueue failed for workflow ${workflowId}: ${(error as Error).message}`;
        this.logger.error(
          `[DIAGNOSTIC][ChatsService] ${errMsg}`,
          (error as Error).stack,
        );
      }
    } else {
      this.logger.warn(
        `[DIAGNOSTIC][ChatsService] ⚠️ Queue enqueue skipped: no workflowId linked to chat ${chat.id}`,
      );
    }

    // Chat messages now follow exact same path as voice: DB → PayloadBuilder → WEBHOOK_DELIVERY
    return createdMessage;
  }
}