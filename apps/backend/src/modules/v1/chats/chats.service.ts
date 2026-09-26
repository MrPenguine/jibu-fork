import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { CreateMessageDto } from './dto/create-message.dto';
import { PrismaService } from '../../../core/database/prisma.service';
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
    private readonly agentRuntime: AgentRuntimeService,
  ) {}

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
    });

    if (!chat) {
      const msg =
        '⚠️ No Chat record found for this chatId/sessionId.';
      this.logger.warn(`[DIAGNOSTIC][ChatsService] ${msg}`);
      throw new BadRequestException(msg);
    }

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
      `[DIAGNOSTIC][ChatsService] Message persisted to DB for chat ${chat.id} with agentId=${agentId ?? 'none'}`,
    );

    // Real activity signal for the idle-timeout sweep (ChatIdleSweepService) —
    // Chat.updatedAt never fires on message writes, only on direct chat.update
    // calls. Resetting status to 'active' re-arms a fresh warn/terminate cycle
    // for the *next* lull, rather than jumping straight to termination if the
    // user replies after already having been warned once.
    if (message.role === 'user') {
      await this.prisma.chat
        .update({ where: { id: chat.id }, data: { lastUserMessageAt: new Date(), status: 'active' } })
        .catch((e) => this.logger.warn(`Failed to update chat activity for ${chat.id}: ${(e as Error).message}`));
    }

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
            // toolCalls is included so the workspace test-chat UI (chats/page.tsx)
            // can show which tools/intents actually fired in a conversation —
            // it was previously computed by the runtime and silently dropped here.
            metadata: { ...(result.meta as object), toolCalls: result.toolCalls ?? [] } as any,
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
        // Surface the failure to the caller instead of silently returning only
        // the user's own message — otherwise the UI has no way to distinguish
        // "the agent is still thinking" from "the model call actually failed".
        return { ...createdMessage, replyError: (error as Error).message };
      }
    }

    this.logger.warn(
      `[DIAGNOSTIC][ChatsService] ⚠️ No agent linked to chat ${chat.id}; no reply generated`,
    );

    return createdMessage;
  }
}