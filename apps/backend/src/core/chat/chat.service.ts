import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import {
  ChatMessage,
  ChatContext,
  ChatConversation,
  ConversationStatus,
  CHAT_REDIS_KEYS,
  CHAT_TTL_CONFIG,
  GetHistoryOptions,
  CreateConversationOptions,
  AddMessageOptions,
  RagContext,
} from './chat.interfaces';
import { RagContextService } from '../services/rag-context.service';

/**
 * ChatService - Redis-based conversation management
 * Phase 4: High-performance chat with Redis caching
 * 
 * Features:
 * - Conversation storage with TTL management
 * - Message history in sorted sets (chronological order)
 * - Active session tracking for cleanup
 * - Context-aware caching with AI context
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly ragContextService: RagContextService,
  ) {}

  /**
   * Create a new conversation
   * Stores conversation metadata in Redis with TTL
   */
  async createConversation(
    sessionId: string,
    options: CreateConversationOptions,
  ): Promise<ChatConversation> {
    const now = Date.now();

    const conversation: ChatConversation = {
      sessionId,
      workflowId: options.workflowId,
      workspaceId: options.workspaceId,
      participants: [
        {
          userId: options.userId,
          role: 'user',
          joinedAt: now,
        },
        {
          role: 'agent',
          joinedAt: now,
        },
      ],
      status: 'active',
      createdAt: now,
      lastActivity: now,
      context: options.initialContext,
      metadata: options.metadata,
    };

    try {
      // Store conversation in Redis with TTL
      const conversationKey = CHAT_REDIS_KEYS.CONVERSATION(sessionId);
      await this.redisService.set(
        conversationKey,
        JSON.stringify(conversation),
        CHAT_TTL_CONFIG.CONVERSATION_TTL,
      );

      // Add to active sessions set
      await this.addToActiveSessionsSet(sessionId);

      // Add to user sessions if userId provided
      if (options.userId) {
        await this.addToUserSessionsSet(options.userId, sessionId);
      }

      this.logger.log(
        `Created conversation ${sessionId} for workflow ${options.workflowId}`,
      );

      return conversation;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to create conversation ${sessionId}: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  /**
   * Add a message to the conversation
   * Stores in Redis sorted set with timestamp as score
   */
  async addMessage(
    sessionId: string,
    options: AddMessageOptions,
  ): Promise<ChatMessage> {
    const timestamp = Date.now();

    const message: ChatMessage = {
      role: options.role,
      content: options.content,
      timestamp,
      isVoice: options.isVoice,
      confidence: options.voiceMetadata?.confidence,
      language: options.voiceMetadata?.language,
      duration: options.voiceMetadata?.duration,
    };

    try {
      // Store message in sorted set (ZSET) with timestamp as score
      const messagesKey = CHAT_REDIS_KEYS.MESSAGES(sessionId);
      const messageJson = JSON.stringify(message);
      
      // Use Redis client directly for ZADD operation
      const redisClient = (this.redisService as any).redisClient;
      await redisClient.zadd(messagesKey, timestamp, messageJson);

      // Set TTL on messages key
      await redisClient.expire(messagesKey, CHAT_TTL_CONFIG.MESSAGE_TTL);

      // Update conversation last activity
      await this.updateLastActivity(sessionId);

      this.logger.debug(
        `Added ${options.role} message to conversation ${sessionId}`,
      );

      return message;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to add message to conversation ${sessionId}: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  /**
   * Get conversation by session ID
   */
  async getConversation(sessionId: string): Promise<ChatConversation | null> {
    try {
      const conversationKey = CHAT_REDIS_KEYS.CONVERSATION(sessionId);
      const conversationJson = await this.redisService.get(conversationKey);

      if (!conversationJson) {
        return null;
      }

      return JSON.parse(conversationJson) as ChatConversation;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to get conversation ${sessionId}: ${err.message}`,
        err.stack,
      );
      return null;
    }
  }

  /**
   * Get conversation history with optional limit
   * Returns messages in chronological order
   */
  async getHistory(
    sessionId: string,
    options: GetHistoryOptions = {},
  ): Promise<ChatMessage[]> {
    const { limit = 50, offset = 0, includeSystem = false } = options;

    try {
      const messagesKey = CHAT_REDIS_KEYS.MESSAGES(sessionId);
      const redisClient = (this.redisService as any).redisClient;

      // Get messages from sorted set (oldest to newest)
      const messageJsons = await redisClient.zrange(
        messagesKey,
        offset,
        offset + limit - 1,
      );

      if (!messageJsons || messageJsons.length === 0) {
        return [];
      }

      // Parse messages
      const messages: ChatMessage[] = messageJsons.map((json: string) =>
        JSON.parse(json),
      );

      // Filter out system messages if not included
      if (!includeSystem) {
        return messages.filter((msg) => msg.role !== 'system');
      }

      return messages;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to get history for conversation ${sessionId}: ${err.message}`,
        err.stack,
      );
      return [];
    }
  }

  /**
   * Get complete conversation context for AI workflows
   * Includes system prompt, conversation history, and RAG context
   */
  async getConversationContext(
    sessionId: string,
    lastMessageText?: string,
  ): Promise<ChatContext> {
    try {
      // Get conversation metadata
      const conversation = await this.getConversation(sessionId);

      if (!conversation) {
        throw new NotFoundException(
          `Conversation ${sessionId} not found`,
        );
      }

      // Get conversation history (last 10 messages)
      const history = await this.getHistory(sessionId, {
        limit: 10,
        includeSystem: false,
      });

      // Get RAG context if message text provided
      let ragContext: RagContext;
      if (lastMessageText) {
        ragContext = await this.ragContextService.getRagContext(
          lastMessageText,
        );
      } else {
        ragContext = {
          results: [],
          query: '',
          fallbackMessage:
            "I'm having trouble accessing that information right now.",
        };
      }

      // Build complete context
      const context: ChatContext = {
        systemPrompt: conversation.context?.systemPrompt || '',
        systemMessage: conversation.context?.systemMessage || '',
        conversationHistory: history,
        ragContext,
      };

      return context;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to get context for conversation ${sessionId}: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  /**
   * Update conversation status
   */
  async updateStatus(
    sessionId: string,
    status: ConversationStatus,
  ): Promise<void> {
    try {
      const conversation = await this.getConversation(sessionId);

      if (!conversation) {
        throw new NotFoundException(
          `Conversation ${sessionId} not found`,
        );
      }

      conversation.status = status;
      conversation.lastActivity = Date.now();

      const conversationKey = CHAT_REDIS_KEYS.CONVERSATION(sessionId);
      await this.redisService.set(
        conversationKey,
        JSON.stringify(conversation),
        CHAT_TTL_CONFIG.CONVERSATION_TTL,
      );

      this.logger.log(
        `Updated conversation ${sessionId} status to ${status}`,
      );
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to update status for conversation ${sessionId}: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  /**
   * Update last activity timestamp
   */
  private async updateLastActivity(sessionId: string): Promise<void> {
    try {
      const conversation = await this.getConversation(sessionId);

      if (!conversation) {
        return;
      }

      conversation.lastActivity = Date.now();

      const conversationKey = CHAT_REDIS_KEYS.CONVERSATION(sessionId);
      await this.redisService.set(
        conversationKey,
        JSON.stringify(conversation),
        CHAT_TTL_CONFIG.CONVERSATION_TTL,
      );
    } catch (error) {
      const err = error as Error;
      this.logger.warn(
        `Failed to update last activity for conversation ${sessionId}: ${err.message}`,
      );
    }
  }

  /**
   * Add session to active sessions set
   */
  private async addToActiveSessionsSet(sessionId: string): Promise<void> {
    try {
      const redisClient = (this.redisService as any).redisClient;
      await redisClient.sadd(CHAT_REDIS_KEYS.ACTIVE_SESSIONS, sessionId);
    } catch (error) {
      const err = error as Error;
      this.logger.warn(
        `Failed to add session ${sessionId} to active sessions: ${err.message}`,
      );
    }
  }

  /**
   * Add session to user sessions set
   */
  private async addToUserSessionsSet(
    userId: string,
    sessionId: string,
  ): Promise<void> {
    try {
      const redisClient = (this.redisService as any).redisClient;
      const userSessionsKey = CHAT_REDIS_KEYS.USER_SESSIONS(userId);
      await redisClient.sadd(userSessionsKey, sessionId);
      
      // Set TTL on user sessions set
      await redisClient.expire(userSessionsKey, CHAT_TTL_CONFIG.CONVERSATION_TTL);
    } catch (error) {
      const err = error as Error;
      this.logger.warn(
        `Failed to add session ${sessionId} to user ${userId} sessions: ${err.message}`,
      );
    }
  }

  /**
   * Get all active sessions
   * Used by cleanup service
   */
  async getActiveSessions(): Promise<string[]> {
    try {
      const redisClient = (this.redisService as any).redisClient;
      const sessions = await redisClient.smembers(
        CHAT_REDIS_KEYS.ACTIVE_SESSIONS,
      );
      return sessions || [];
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to get active sessions: ${err.message}`,
        err.stack,
      );
      return [];
    }
  }

  /**
   * Remove session from active sessions
   * Used by cleanup service
   */
  async removeFromActiveSessions(sessionId: string): Promise<void> {
    try {
      const redisClient = (this.redisService as any).redisClient;
      await redisClient.srem(CHAT_REDIS_KEYS.ACTIVE_SESSIONS, sessionId);
    } catch (error) {
      const err = error as Error;
      this.logger.warn(
        `Failed to remove session ${sessionId} from active sessions: ${err.message}`,
      );
    }
  }

  /**
   * Delete conversation and all associated data
   * Used by cleanup service
   */
  async deleteConversation(sessionId: string): Promise<void> {
    try {
      const conversationKey = CHAT_REDIS_KEYS.CONVERSATION(sessionId);
      const messagesKey = CHAT_REDIS_KEYS.MESSAGES(sessionId);

      await this.redisService.del(conversationKey);
      await this.redisService.del(messagesKey);
      await this.removeFromActiveSessions(sessionId);

      this.logger.log(`Deleted conversation ${sessionId}`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to delete conversation ${sessionId}: ${err.message}`,
        err.stack,
      );
    }
  }

  /**
   * Get user sessions
   */
  async getUserSessions(userId: string): Promise<string[]> {
    try {
      const redisClient = (this.redisService as any).redisClient;
      const userSessionsKey = CHAT_REDIS_KEYS.USER_SESSIONS(userId);
      const sessions = await redisClient.smembers(userSessionsKey);
      return sessions || [];
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to get sessions for user ${userId}: ${err.message}`,
        err.stack,
      );
      return [];
    }
  }
}
