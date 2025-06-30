import { Injectable, NotFoundException, ForbiddenException, Logger, HttpException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { RedisService } from '../../../core/redis/redis.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import { N8nClient } from '../../../core/n8n-orchestrator/n8n-client';
import { N8nWorkflowService } from '../../../core/n8n-orchestrator/n8n-workflow.service';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { Assistant, Chat, Prisma } from '@prisma/client';

// Custom type for Assistant with n8n fields
type AssistantWithN8n = {
  id: string;
  name: string;
  n8nWorkflowId?: string | null;
  webhookUrl?: string | null;
  [key: string]: any; // Allow other properties
};

// Define expected response from N8n webhook validation
interface WebhookValidationResponse {
  valid: boolean;
  message?: string;
}

// Extended chat type to include system prompt
interface ChatWithSystemPrompt extends Chat {
  systemPrompt?: string;
}

// Type for message in Redis chat history
interface ChatHistoryMessage {
  role: string;
  content: string;
  id: string;
  timestamp: Date;
}

// Type for webhook response from n8n
interface N8nWebhookResponse {
  output: string;
  metadata: any;
}

@Injectable()
export class ChatsService {
  private readonly logger = new Logger(ChatsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly n8nClient: N8nClient,
    private readonly n8nWorkflowService: N8nWorkflowService,
    private readonly configService: ConfigService
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

  /**
   * Creates a new message in a chat and processes it through n8n if it's a user message
   * @param chatId The chat ID to create the message in
   * @param createMessageDto The message data
   * @param organizationId The organization ID for access control
   * @returns The created user message and assistant response (if applicable)
   */
  async createMessage(chatId: string, createMessageDto: CreateMessageDto, organizationId: string) {
    this.logger.log(`Creating new message for chat ${chatId}`);
    this.logger.log(`Message content: ${createMessageDto.content.substring(0, 50)}... (role: ${createMessageDto.role})`);
    
    // Verify chat exists and belongs to the organization
    const chat = await this.getChat(chatId, organizationId);

    // Create the message from user
    const userMessage = await this.prisma.message.create({
      data: {
        chatId,
        content: createMessageDto.content,
        role: createMessageDto.role,
        type: createMessageDto.type || 'text',
        sequenceId: createMessageDto.sequenceId,
        metadata: createMessageDto.metadata || {}
      }
    });

    this.logger.log(`Successfully created user message ${userMessage.id} for chat ${chatId}`);

    // Update the chat's updatedAt timestamp
    await this.prisma.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() }
    });

    // Update Redis chat history
    await this.updateChatInRedis(chatId, chat.assistantId, chat.sessionId, userMessage);

    // Only if this is a user message, process it through n8n
    if (createMessageDto.role === 'user') {
      try {
        // Get the associated assistant if this chat has one
        let systemPrompt = '';
        let temperature = 0.7;
        
        if (chat.assistantId) {
          // Get assistant properties (system prompt, temperature)
          const assistant = await this.prisma.assistant.findUnique({
            where: { id: chat.assistantId },
            select: { model: true, organizationId: true }
          });
          
          if (assistant) {
            // Try to get system prompt from the assistant model
            if (assistant.model && typeof assistant.model === 'object') {
              const model = assistant.model as Record<string, any>;
              if (typeof model.systemPrompt === 'string') {
                systemPrompt = model.systemPrompt;
              }
              if (typeof model.temperature === 'number') {
                temperature = model.temperature;
              }
            }
            
            // Make sure the N8nWorkflow exists for this assistant - this will ensure
            // it's created and activated if it doesn't exist yet
            try {
              await this.n8nWorkflowService.getOrCreateAssistantWorkflow(
                chat.assistantId,
                assistant.organizationId
              );
              this.logger.log(`Verified n8n workflow exists for assistant ${chat.assistantId}`);
            } catch (e) {
              this.logger.warn(`Error verifying n8n workflow for assistant ${chat.assistantId}: ${e.message}`);
              // Continue anyway, the callN8nWebhook will try to get/create the workflow again
            }
          }
        }
        
        // If no system prompt was found, use a default or the chat's system prompt
        if (!systemPrompt) {
          // Cast chat to extended type that includes systemPrompt
          const chatWithPrompt = chat as ChatWithSystemPrompt;
          systemPrompt = chatWithPrompt.systemPrompt || 'You are a helpful assistant.';
        }
        
        this.logger.log(`Processing message through n8n for chat ${chatId}`);
        
        // Call the n8n webhook with message content
        // If this chat has an assistant, use its dedicated workflow
        const n8nResponse = await this.callN8nWebhook({
          sessionId: chatId, // Using chatId as the session ID for continuity
          systemPrompt,
          temperature, // Use the configured temperature
          chatInput: createMessageDto.content
        }, chat.assistantId); // Pass the assistantId to use its dedicated workflow
        
        if (n8nResponse) {
          const assistantContent = n8nResponse.output;
          const assistantMetadata = n8nResponse.metadata;

          // Create a new message for the assistant's response
          const assistantMessage = await this.prisma.message.create({
            data: {
              chat: { connect: { id: chatId } },
              content: assistantContent,
              role: 'assistant',
              type: 'text',
              sequenceId: createMessageDto.sequenceId + 1,
              metadata: assistantMetadata
            }
          });

          this.logger.log(`Created n8n response message ${assistantMessage.id} for chat ${chatId}`);

          // Update Redis chat history with assistant response
          await this.updateChatInRedis(chatId, chat.assistantId, chat.sessionId, assistantMessage);

          // Return both messages
          return {
            userMessage,
            assistantMessage
          };
        } else {
          // If n8n response is null, log error and return user message only
          this.logger.error(`n8n webhook returned null response for chat ${chatId}`);
          
          // Return only the user message since n8n failed to respond
          return { userMessage };
        }
      } catch (error) {
        this.logger.error(`Error processing message through n8n: ${error.message}`);
        if (error.stack) {
          this.logger.error(`Stack trace: ${error.stack}`);
        }
        
        // If there's an error with n8n, log it and return user message only
        if (error.response) {
          this.logger.error(`n8n webhook error (${error.response.status}): ${error.response.data}`);
        } else {
          this.logger.error(`n8n webhook error: ${error.message}`);
        }
        
        // Return only the user message since n8n failed
        return { userMessage };
      }
    }
    
    // If we reach here, it wasn't a user message that requires response (e.g., system message)
    return { userMessage };
  } // End of createMessage method

  /**
   * Call the n8n webhook with message data
   * @param data The data to send to the webhook including sessionId, systemPrompt, temperature, and chatInput
   * @param assistantId Optional assistant ID to use its dedicated workflow
   * @returns The response from n8n or null if error
   */
  private async callN8nWebhook(data: {
    sessionId: string;
    systemPrompt: string;
    temperature: number;
    chatInput: string;
  }, assistantId?: string): Promise<N8nWebhookResponse | null> {
    try {
      let webhookUrl: string | undefined;
      let organizationId: string | undefined;
      
      // If assistant ID is provided, get its organization ID and use its dedicated workflow
      if (assistantId) {
        // Get the organization ID for the assistant
        const assistant = await this.prisma.assistant.findUnique({
          where: { id: assistantId },
          select: { organizationId: true }
        });
        
        organizationId = assistant?.organizationId;
        
        if (!organizationId) {
          this.logger.error(`Could not find organization ID for assistant ${assistantId}`);
          return null;
        }
        
        // Use the N8nWorkflowService to get or create a workflow for this assistant
        const workflow = await this.n8nWorkflowService.getOrCreateAssistantWorkflow(
          assistantId,
          organizationId
        );
        
        if (!workflow) {
          this.logger.error(`Could not get or create workflow for assistant ${assistantId}`);
          return null;
        }
        
        webhookUrl = workflow.webhookUrl;
      } else {
        // Fall back to default webhook
        webhookUrl = this.configService.get<string>('N8N_WEBHOOK_URL');
      }
      
      if (!webhookUrl) {
        this.logger.error('No webhook URL available for assistant or in environment');
        return null;
      }
      
      this.logger.log(`Calling n8n webhook: ${webhookUrl.replace(/\/\/[^:]+:[^@]+@/, '\/\/***:***@')}`); // Log URL with masked auth if present
      
      // Prepare the payload with top-level properties (not nested in body)
      // Send directly in the request body format expected by n8n webhook
      const response = await axios.post(webhookUrl, {
        sessionId: data.sessionId,
        systemPrompt: data.systemPrompt,
        temperature: data.temperature,
        chatInput: data.chatInput
      });
      
      // Check if response is in expected format
      this.logger.log(`Received response from n8n webhook with status ${response.status}`);
      
      return {
        output: response.data?.data?.[0]?.json?.output || response.data,
        metadata: response.data
      };
    } catch (error) {
      this.logger.error(`Error calling n8n webhook: ${(error as Error).message}`);
      
      // Log more details about the error if available
      if ((error as any).response) {
        this.logger.error(`n8n webhook response status: ${(error as any).response.status}`);
        this.logger.error(`n8n webhook response data: ${JSON.stringify((error as any).response.data)}`);
      }
      
      // Return null instead of throwing to allow fallback to LangChain Agent
      return null;
    }
  }

  /**
   * Initialize a new chat history in Redis
   * @param chatId The chat ID
   * @param assistantId The associated assistant ID, if any
   * @param sessionId The session ID for the chat
   * @param agentId The associated agent ID, if any
   */
  private async initChatInRedis(chatId: string, assistantId: string | null, sessionId: string, agentId: string | null = null): Promise<void> {
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
      this.logger.error(`Failed to initialize Redis chat history: ${(error as Error).message}`);
      // Continue even if Redis fails - the chat will still work with database storage
    }
  }

  /**
   * Update chat history in Redis with a new message
   * @param chatId The chat ID
   * @param assistantId The associated assistant ID, if any
   * @param sessionId The session ID for the chat
   * @param message The message to add to history
   */
  private async updateChatInRedis(chatId: string, assistantId: string | null, sessionId: string, message: { role: string; content: string; id: string; createdAt: Date }): Promise<void> {
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
      let chatHistory: Array<{ role: string; content: string; id: string; timestamp: Date }> = [];
      
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
      
      // Limit history to 2000 messages as per requirements
      if (chatHistory.length > 2000) {
        chatHistory = chatHistory.slice(-2000);
      }
      
      // Save back to Redis
      await this.redis.set(redisKey, JSON.stringify(chatHistory));
      this.logger.log(`Updated Redis chat history for ${redisKey}`);
    } catch (error) {
      this.logger.error(`Failed to update Redis chat history: ${(error as Error).message}`);
      // Continue even if Redis fails
    }
  }

  /**
   * Remove a chat history from Redis
   * @param chatId The chat ID to remove
   * @param assistantId The associated assistant ID, if any
   * @param sessionId The session ID for the chat
   */
  private async removeChatFromRedis(chatId: string, assistantId: string | null, sessionId: string): Promise<void> {
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
      this.logger.error(`Failed to remove Redis chat history: ${(error as Error).message}`);
      // Continue even if Redis fails
    }
  }
}