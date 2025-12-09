import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ConversationMessage } from '@jibu/queue-definitions';

@Injectable()
export class ChatHistoryService {
  private readonly logger = new Logger(ChatHistoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getConversationHistory(
    sessionId: string,
    workflowId?: string,
  ): Promise<ConversationMessage[]> {
    if (!sessionId) {
      return [];
    }

    try {
      const chat = await this.prisma.chat.findFirst({
        where: {
          sessionId,
          ...(workflowId ? { workflowId } : {}),
        },
        include: {
          messages: {
            orderBy: { sequenceId: 'asc' },
          },
        },
      });

      if (!chat || !Array.isArray(chat.messages) || chat.messages.length === 0) {
        return [];
      }

      return chat.messages.map((message) => {
        const role =
          message.role === 'assistant' || message.role === 'user'
            ? (message.role as 'assistant' | 'user')
            : 'assistant';

        return {
          role,
          content: message.content,
          timestamp: message.createdAt.getTime(),
          speaker: message.role,
          messageId: message.id,
        };
      });
    } catch (error) {
      this.logger.error(
        `Failed to load conversation history for session ${sessionId} (workflow ${workflowId ?? 'n/a'}): ${(error as Error).message}`,
      );
      return [];
    }
  }

  async getConversationHistoryForSession(
    sessionId: string,
    workflowId?: string,
  ): Promise<ConversationMessage[]> {
    return this.getConversationHistory(sessionId, workflowId);
  }
}
