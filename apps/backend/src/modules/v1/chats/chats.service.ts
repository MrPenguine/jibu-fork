import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { RedisService } from '../../../core/redis/redis.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateChatDto } from './dto/update-chat.dto';

@Injectable()
export class ChatsService {
  private readonly logger = new Logger(ChatsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService
  ) {}

  async createChat(createChatDto: CreateChatDto & { organizationId: string }) {
    // Log creation with appropriate entity (assistant or agent)
    if (createChatDto.assistantId) {
      this.logger.log(`Creating chat for assistant ${createChatDto.assistantId} in organization ${createChatDto.organizationId}`);
    } else if (createChatDto.agentId) {
      this.logger.log(`Creating chat for agent ${createChatDto.agentId} in organization ${createChatDto.organizationId}`);
    }
    
    this.logger.log(`Session ID: ${createChatDto.sessionId}, Session Type: ${createChatDto.sessionType || 'chat'}`);
    
    // Check if assistant exists if assistantId is provided
    if (createChatDto.assistantId) {
      const assistant = await this.prisma.assistant.findFirst({
        where: {
          id: createChatDto.assistantId,
          organizationId: createChatDto.organizationId
        }
      });

      if (!assistant) {
        this.logger.error(`Assistant ${createChatDto.assistantId} not found in organization ${createChatDto.organizationId}`);
        throw new NotFoundException(`Assistant not found or not accessible in this organization`);
      }
    }

    // Check if agent exists if agentId is provided
    if (createChatDto.agentId) {
      const agent = await this.prisma.agent.findFirst({
        where: {
          id: createChatDto.agentId,
          organizationId: createChatDto.organizationId
        }
      });

      if (!agent) {
        this.logger.error(`Agent ${createChatDto.agentId} not found in organization ${createChatDto.organizationId}`);
        throw new NotFoundException(`Agent not found or not accessible in this organization`);
      }
    }

    // Check if workflow exists if workflowId is provided
    if (createChatDto.workflowId) {
      const workflow = await this.prisma.workflow.findFirst({
        where: {
          id: createChatDto.workflowId,
          organizationId: createChatDto.organizationId
        }
      });

      if (!workflow) {
        this.logger.error(`Workflow ${createChatDto.workflowId} not found in organization ${createChatDto.organizationId}`);
        throw new NotFoundException(`Workflow not found or not accessible in this organization`);
      }
    }

    // Build data object conditionally to avoid sending undefined fields to Prisma
    const chatData: any = {
      name: createChatDto.name || 'New Chat',
      organization: { connect: { id: createChatDto.organizationId } }, // Use relation connection
      sessionId: createChatDto.sessionId,
      sessionType: createChatDto.sessionType || 'chat',
      metadata: createChatDto.metadata || {}
    };
    
    // Only include fields if they're defined
    if (createChatDto.assistantId) {
      chatData.assistant = { connect: { id: createChatDto.assistantId } }; // Use relation connection
    }
    
    if (createChatDto.agentId) {
      chatData.agent = { connect: { id: createChatDto.agentId } }; // Use relation connection
    }
    
    if (createChatDto.workflowId) {
      chatData.workflow = { connect: { id: createChatDto.workflowId } }; // Use relation connection
    }
    
    if (createChatDto.nodeType) {
      chatData.nodeType = createChatDto.nodeType;
    }

    // Create the chat with properly formed data object
    const chat = await this.prisma.chat.create({
      data: chatData
    });

    this.logger.log(`Successfully created chat with ID: ${chat.id}`);

    // Initialize Redis chat history if Redis is available
    await this.initChatInRedis(chat.id, chat.assistantId || null, chat.sessionId, chat.agentId || null);

    return chat;
  }

  async updateChat(id: string, updateChatDto: UpdateChatDto, organizationId: string) {
    this.logger.log(`Updating chat ${id} in organization ${organizationId}`);
    
    // Verify chat exists and belongs to the organization
    const chat = await this.getChat(id, organizationId);

    // Update the chat
    const updatedChat = await this.prisma.chat.update({
      where: { id },
      data: {
        ...(updateChatDto.name && { name: updateChatDto.name }),
        ...(updateChatDto.sessionType && { sessionType: updateChatDto.sessionType }),
        ...(updateChatDto.metadata && { metadata: updateChatDto.metadata }),
        updatedAt: new Date() // Ensure updatedAt is refreshed
      }
    });

    this.logger.log(`Successfully updated chat ${id}`);
    return updatedChat;
  }

  async getChats(organizationId: string, assistantId: string, filters?: { sessionType?: string, sessionId?: string, agentId?: string, workflowId?: string }) {
    this.logger.log(`Getting chats for assistant ${assistantId} in organization ${organizationId}`);
    if (filters) {
      this.logger.log(`Filters: ${JSON.stringify(filters)}`);
    }
    
    // Validate that assistant exists in this organization
    const assistant = await this.prisma.assistant.findFirst({
      where: {
        id: assistantId,
        organizationId
      }
    });

    if (!assistant) {
      this.logger.error(`Assistant ${assistantId} not found in organization ${organizationId}`);
      throw new NotFoundException(`Assistant not found or not accessible in this organization`);
    }

    // Build the query
    const where: any = {
      organizationId,
      assistantId
    };

    // Add filters if provided
    if (filters?.sessionType) {
      where.sessionType = filters.sessionType;
    }

    if (filters?.sessionId) {
      where.sessionId = filters.sessionId;
    }
    
    if (filters?.agentId) {
      where.agentId = filters.agentId;
    }
    
    if (filters?.workflowId) {
      where.workflowId = filters.workflowId;
    }

    // Get the chats
    const chats = await this.prisma.chat.findMany({
      where,
      orderBy: {
        updatedAt: 'desc'
      },
      include: {
        messages: {
          orderBy: {
            sequenceId: 'desc'
          },
          take: 1, // Get only the last message for preview
        }
      }
    });

    this.logger.log(`Found ${chats.length} chats for assistant ${assistantId}`);

    // Format the response to include the last message content as lastMessage
    return chats.map(chat => ({
      id: chat.id,
      name: chat.name,
      assistantId: chat.assistantId,
      agentId: chat.agentId,
      workflowId: chat.workflowId,
      nodeType: chat.nodeType,
      sessionId: chat.sessionId,
      sessionType: chat.sessionType,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      lastMessage: chat.messages[0]?.content || null
    }));
  }
  
  async getChatsByAgentId(organizationId: string, agentId: string, filters?: { sessionType?: string, sessionId?: string, workflowId?: string }) {
    this.logger.log(`Getting chats for agent ${agentId} in organization ${organizationId}`);
    if (filters) {
      this.logger.log(`Filters: ${JSON.stringify(filters)}`);
    }
    
    // Validate that agent exists in this organization
    const agent = await this.prisma.agent.findFirst({
      where: {
        id: agentId,
        organizationId
      }
    });

    if (!agent) {
      this.logger.error(`Agent ${agentId} not found in organization ${organizationId}`);
      throw new NotFoundException(`Agent not found or not accessible in this organization`);
    }

    // Build the query
    const where: any = {
      organizationId,
      agentId
    };

    // Add filters if provided
    if (filters?.sessionType) {
      where.sessionType = filters.sessionType;
    }

    if (filters?.sessionId) {
      where.sessionId = filters.sessionId;
    }
    
    if (filters?.workflowId) {
      where.workflowId = filters.workflowId;
    }

    // Get the chats
    const chats = await this.prisma.chat.findMany({
      where,
      orderBy: {
        updatedAt: 'desc'
      },
      include: {
        messages: {
          orderBy: {
            sequenceId: 'desc'
          },
          take: 1, // Get only the last message for preview
        }
      }
    });

    this.logger.log(`Found ${chats.length} chats for agent ${agentId}`);

    // Format the response to include the last message content as lastMessage
    return chats.map(chat => ({
      id: chat.id,
      name: chat.name,
      assistantId: chat.assistantId,
      agentId: chat.agentId,
      workflowId: chat.workflowId,
      nodeType: chat.nodeType,
      sessionId: chat.sessionId,
      sessionType: chat.sessionType,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      lastMessage: chat.messages[0]?.content || null
    }));
  }
  
  async getChatsByWorkflowId(organizationId: string, workflowId: string, filters?: { sessionType?: string, sessionId?: string, agentId?: string }) {
    this.logger.log(`Getting chats for workflow ${workflowId} in organization ${organizationId}`);
    if (filters) {
      this.logger.log(`Filters: ${JSON.stringify(filters)}`);
    }
    
    // Validate that workflow exists in this organization
    const workflow = await this.prisma.workflow.findFirst({
      where: {
        id: workflowId,
        organizationId
      }
    });

    if (!workflow) {
      this.logger.error(`Workflow ${workflowId} not found in organization ${organizationId}`);
      throw new NotFoundException(`Workflow not found or not accessible in this organization`);
    }

    // Build the query
    const where: any = {
      organizationId,
      workflowId
    };

    // Add filters if provided
    if (filters?.sessionType) {
      where.sessionType = filters.sessionType;
    }

    if (filters?.sessionId) {
      where.sessionId = filters.sessionId;
    }
    
    if (filters?.agentId) {
      where.agentId = filters.agentId;
    }

    // Get the chats
    const chats = await this.prisma.chat.findMany({
      where,
      orderBy: {
        updatedAt: 'desc'
      },
      include: {
        messages: {
          orderBy: {
            sequenceId: 'desc'
          },
          take: 1, // Get only the last message for preview
        }
      }
    });

    this.logger.log(`Found ${chats.length} chats for workflow ${workflowId}`);

    // Format the response to include the last message content as lastMessage
    return chats.map(chat => ({
      id: chat.id,
      name: chat.name,
      assistantId: chat.assistantId,
      agentId: chat.agentId,
      workflowId: chat.workflowId,
      nodeType: chat.nodeType,
      sessionId: chat.sessionId,
      sessionType: chat.sessionType,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      lastMessage: chat.messages[0]?.content || null
    }));
  }

  async getChat(id: string, organizationId: string) {
    this.logger.log(`Getting chat ${id} for organization ${organizationId}`);
    
    const chat = await this.prisma.chat.findUnique({
      where: { id },
      include: {
        assistant: true
      }
    });

    if (!chat) {
      this.logger.error(`Chat ${id} not found`);
      throw new NotFoundException(`Chat with ID ${id} not found`);
    }

    if (chat.organizationId !== organizationId) {
      this.logger.error(`Chat ${id} not accessible in organization ${organizationId}`);
      throw new ForbiddenException(`Chat not accessible in this organization`);
    }

    this.logger.log(`Successfully retrieved chat ${id}`);
    return chat;
  }

  async deleteChat(id: string, organizationId: string) {
    this.logger.log(`Deleting chat ${id} from organization ${organizationId}`);
    
    // Verify chat exists and belongs to the organization
    const chat = await this.getChat(id, organizationId);

    // Delete the chat
    await this.prisma.chat.delete({
      where: { id }
    });

    this.logger.log(`Successfully deleted chat ${id}`);

    // Remove from Redis if available
    await this.removeChatFromRedis(id, chat.assistantId, chat.sessionId);

    return { success: true };
  }

  async getChatMessages(chatId: string, organizationId: string) {
    this.logger.log(`Getting messages for chat ${chatId} in organization ${organizationId}`);
    
    // Verify chat exists and belongs to the organization
    await this.getChat(chatId, organizationId);

    // Get all messages for the chat
    const messages = await this.prisma.message.findMany({
      where: { chatId },
      orderBy: { sequenceId: 'asc' }
    });

    this.logger.log(`Found ${messages.length} messages for chat ${chatId}`);
    return messages;
  }

  async createMessage(chatId: string, createMessageDto: CreateMessageDto, organizationId: string) {
    this.logger.log(`Creating message for chat ${chatId} in organization ${organizationId}`);
    this.logger.log(`Message content: ${createMessageDto.content.substring(0, 50)}... (role: ${createMessageDto.role})`);
    
    // Verify chat exists and belongs to the organization
    const chat = await this.getChat(chatId, organizationId);

    // Create the message
    const message = await this.prisma.message.create({
      data: {
        chatId,
        content: createMessageDto.content,
        role: createMessageDto.role,
        type: createMessageDto.type || 'text',
        sequenceId: createMessageDto.sequenceId,
        metadata: createMessageDto.metadata || {}
      }
    });

    this.logger.log(`Successfully created message ${message.id} for chat ${chatId}`);

    // Update the chat's updatedAt timestamp
    await this.prisma.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() }
    });

    // Update Redis chat history
    await this.updateChatInRedis(chatId, chat.assistantId, chat.sessionId, message);

    return message;
  }

  // Helper methods for Redis integration
  private async initChatInRedis(chatId: string, assistantId: string | null, sessionId: string, agentId: string | null = null) {
    try {
      // Create an appropriate Redis key based on available IDs
      let redisKey: string;
      if (assistantId) {
        redisKey = `chat:assistant:${assistantId}:${sessionId}`;
      } else if (agentId) {
        redisKey = `chat:agent:${agentId}:${sessionId}`;
      } else {
        redisKey = `chat:${chatId}:${sessionId}`;
      }
      
      await this.redis.set(redisKey, JSON.stringify([]));
      this.logger.log(`Initialized Redis chat history for ${redisKey}`);
    } catch (error) {
      this.logger.error(`Failed to initialize Redis chat history: ${error.message}`);
      // Continue even if Redis fails - the chat will still work with database storage
    }
  }

  private async updateChatInRedis(chatId: string, assistantId: string | null, sessionId: string, message: any) {
    try {
      // Determine the correct Redis key based on the chat type
      let redisKey: string;
      const chat = await this.prisma.chat.findUnique({ where: { id: chatId } });
      
      if (chat?.assistantId) {
        redisKey = `chat:assistant:${chat.assistantId}:${sessionId}`;
      } else if (chat?.agentId) {
        redisKey = `chat:agent:${chat.agentId}:${sessionId}`;
      } else {
        redisKey = `chat:${chatId}:${sessionId}`;
      }
      
      // Get existing chat history from Redis
      const existingChatHistory = await this.redis.get(redisKey);
      let chatHistory = [];
      
      if (existingChatHistory) {
        chatHistory = JSON.parse(existingChatHistory);
      }
      
      // Add the new message
      chatHistory.push({
        role: message.role,
        content: message.content,
        id: message.id,
        timestamp: message.createdAt
      });
      
      // Save back to Redis
      await this.redis.set(redisKey, JSON.stringify(chatHistory));
      this.logger.log(`Updated Redis chat history for ${redisKey}`);
    } catch (error) {
      this.logger.error(`Failed to update Redis chat history: ${error.message}`);
      // Continue even if Redis fails
    }
  }

  private async removeChatFromRedis(chatId: string, assistantId: string | null, sessionId: string) {
    try {
      // Determine the correct Redis key based on the chat type
      let redisKey: string;
      const chat = await this.prisma.chat.findUnique({ where: { id: chatId } });
      
      if (chat?.assistantId) {
        redisKey = `chat:assistant:${chat.assistantId}:${sessionId}`;
      } else if (chat?.agentId) {
        redisKey = `chat:agent:${chat.agentId}:${sessionId}`;
      } else {
        redisKey = `chat:${chatId}:${sessionId}`;
      }
      
      await this.redis.del(redisKey);
      this.logger.log(`Removed Redis chat history for ${redisKey}`);
    } catch (error) {
      this.logger.error(`Failed to remove Redis chat history: ${error.message}`);
      // Continue even if Redis fails
    }
  }
}