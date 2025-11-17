import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ChatService } from '../../core/chat/chat.service';
import { MessageQueueService } from '../../core/services/message-queue.service';
import { StartConversationDto, SendMessageDto } from './dtos';
import { ChatConversation, ChatMessage } from '../../core/chat/chat.interfaces';

/**
 * ChatController - REST API for chat system
 * Phase 4: High-performance chat with Redis caching
 * 
 * Endpoints:
 * - POST /api/v1/chat/start - Start new conversation
 * - POST /api/v1/chat/message - Send message to conversation
 * - GET /api/v1/chat/history/:sessionId - Get conversation history
 */
@ApiTags('Chat')
@Controller('api/v1/chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly messageQueueService: MessageQueueService,
  ) {}

  /**
   * Start a new conversation
   */
  @Post('start')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Start a new conversation',
    description: 'Creates a new conversation with workflow and optional context',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Conversation created successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid request data',
  })
  async startConversation(
    @Body() dto: StartConversationDto,
  ): Promise<ChatConversation> {
    const startTime = Date.now();

    try {
      this.logger.log(
        `Starting conversation ${dto.sessionId} for workflow ${dto.workflowId}`,
      );

      // Create conversation in Redis
      const conversation = await this.chatService.createConversation(
        dto.sessionId,
        {
          workflowId: dto.workflowId,
          workspaceId: dto.workspaceId,
          userId: dto.userId,
          initialContext: dto.initialContext,
          metadata: dto.metadata,
        },
      );

      const duration = Date.now() - startTime;
      this.logger.log(
        `Conversation ${dto.sessionId} created in ${duration}ms`,
      );

      return conversation;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to start conversation ${dto.sessionId}: ${err.message}`,
        err.stack,
      );
      throw new BadRequestException(
        `Failed to start conversation: ${err.message}`,
      );
    }
  }

  /**
   * Send a message to an existing conversation
   */
  @Post('message')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send message to conversation',
    description: 'Sends a message to an existing conversation with automatic context retrieval',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Message sent successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Conversation not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid request data',
  })
  async sendMessage(
    @Body() dto: SendMessageDto,
  ): Promise<{ success: boolean; message: ChatMessage }> {
    const startTime = Date.now();

    try {
      this.logger.log(
        `Sending message to conversation ${dto.sessionId}`,
      );

      // Verify conversation exists
      const conversation = await this.chatService.getConversation(dto.sessionId);
      if (!conversation) {
        throw new NotFoundException(
          `Conversation ${dto.sessionId} not found`,
        );
      }

      // Validate voice metadata if voice message
      if (dto.isVoice && !dto.voiceMetadata) {
        throw new BadRequestException(
          'Voice metadata is required for voice messages',
        );
      }

      // Add user message to conversation history
      const message = await this.chatService.addMessage(dto.sessionId, {
        role: 'user',
        content: dto.text,
        isVoice: dto.isVoice,
        voiceMetadata: dto.voiceMetadata,
      });

      // Get complete conversation context
      const context = await this.chatService.getConversationContext(
        dto.sessionId,
        dto.text,
      );

      // Convert context to AiContext format
      const aiContext = {
        systemPrompt: context.systemPrompt,
        systemMessage: context.systemMessage,
        conversationHistory: context.conversationHistory.map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
          timestamp: msg.timestamp,
        })),
        ragContext: context.ragContext,
      };

      // Send to webhook queue with context
      if (dto.isVoice && dto.voiceMetadata) {
        await this.messageQueueService.sendVoiceMessageToWorkflow(
          conversation.workflowId,
          dto.sessionId,
          dto.text,
          dto.voiceMetadata,
          aiContext,
        );
      } else {
        await this.messageQueueService.sendMessageToWorkflow(
          conversation.workflowId,
          dto.sessionId,
          dto.text,
          aiContext,
        );
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `Message sent to conversation ${dto.sessionId} in ${duration}ms`,
      );

      return {
        success: true,
        message,
      };
    } catch (error) {
      const err = error as Error;
      
      if (err instanceof NotFoundException) {
        throw err;
      }
      
      if (err instanceof BadRequestException) {
        throw err;
      }

      this.logger.error(
        `Failed to send message to conversation ${dto.sessionId}: ${err.message}`,
        err.stack,
      );
      throw new BadRequestException(
        `Failed to send message: ${err.message}`,
      );
    }
  }

  /**
   * Get conversation history
   */
  @Get('history/:sessionId')
  @ApiOperation({
    summary: 'Get conversation history',
    description: 'Retrieves conversation history with configurable limit',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'Session ID of the conversation',
    example: 'session_123abc',
  })
  @ApiQuery({
    name: 'limit',
    description: 'Maximum number of messages to retrieve',
    required: false,
    example: 50,
  })
  @ApiQuery({
    name: 'offset',
    description: 'Number of messages to skip',
    required: false,
    example: 0,
  })
  @ApiQuery({
    name: 'includeSystem',
    description: 'Include system messages',
    required: false,
    example: false,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Conversation history retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Conversation not found',
  })
  async getHistory(
    @Param('sessionId') sessionId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('includeSystem') includeSystem?: boolean,
  ): Promise<{ sessionId: string; messages: ChatMessage[] }> {
    try {
      this.logger.log(`Getting history for conversation ${sessionId}`);

      // Verify conversation exists
      const conversation = await this.chatService.getConversation(sessionId);
      if (!conversation) {
        throw new NotFoundException(
          `Conversation ${sessionId} not found`,
        );
      }

      // Get history with options
      const messages = await this.chatService.getHistory(sessionId, {
        limit: limit ? parseInt(limit.toString()) : 50,
        offset: offset ? parseInt(offset.toString()) : 0,
        includeSystem: includeSystem === true || includeSystem?.toString() === 'true',
      });

      return {
        sessionId,
        messages,
      };
    } catch (error) {
      const err = error as Error;
      
      if (err instanceof NotFoundException) {
        throw err;
      }

      this.logger.error(
        `Failed to get history for conversation ${sessionId}: ${err.message}`,
        err.stack,
      );
      throw new BadRequestException(
        `Failed to get history: ${err.message}`,
      );
    }
  }

  /**
   * Get conversation details
   */
  @Get('conversation/:sessionId')
  @ApiOperation({
    summary: 'Get conversation details',
    description: 'Retrieves conversation metadata and status',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'Session ID of the conversation',
    example: 'session_123abc',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Conversation details retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Conversation not found',
  })
  async getConversation(
    @Param('sessionId') sessionId: string,
  ): Promise<ChatConversation> {
    try {
      this.logger.log(`Getting conversation ${sessionId}`);

      const conversation = await this.chatService.getConversation(sessionId);
      
      if (!conversation) {
        throw new NotFoundException(
          `Conversation ${sessionId} not found`,
        );
      }

      return conversation;
    } catch (error) {
      const err = error as Error;
      
      if (err instanceof NotFoundException) {
        throw err;
      }

      this.logger.error(
        `Failed to get conversation ${sessionId}: ${err.message}`,
        err.stack,
      );
      throw new BadRequestException(
        `Failed to get conversation: ${err.message}`,
      );
    }
  }
}
