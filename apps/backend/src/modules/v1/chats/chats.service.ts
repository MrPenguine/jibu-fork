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
import { Agent, Assistant, Chat, Message, Prisma } from '@prisma/client';

// Custom type for Assistant with n8n fields
type AssistantWithN8n = Assistant & {
  n8nWorkflowId?: string | null;
  webhookUrl?: string | null;
};

// Custom type for Agent with n8n fields
type AgentWithN8n = Agent & {
  metadata?: {
    n8nWorkflowId?: string | null;
    webhookUrl?: string | null;
    [key: string]: any;
  };
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
    if (createChatDto.assistantId) {
      this.logger.log(`Creating chat for assistant ${createChatDto.assistantId} in organization ${createChatDto.organizationId}`);
    } else if (createChatDto.agentId) {
      this.logger.log(`Creating chat for agent ${createChatDto.agentId} in organization ${createChatDto.organizationId}`);
    }
    
    this.logger.log(`Session ID: ${createChatDto.sessionId}, Session Type: ${createChatDto.sessionType || 'chat'}`);
    
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

    const chatData: Prisma.ChatCreateInput = {
      name: createChatDto.name || 'New Chat',
      organization: { connect: { id: createChatDto.organizationId } },
      sessionId: createChatDto.sessionId,
      sessionType: createChatDto.sessionType || 'chat',
      metadata: createChatDto.metadata || {},
      ...(createChatDto.assistantId && { assistant: { connect: { id: createChatDto.assistantId } } }),
      ...(createChatDto.agentId && { agent: { connect: { id: createChatDto.agentId } } }),
      ...(createChatDto.workflowId && { workflow: { connect: { id: createChatDto.workflowId } } }),
      ...(createChatDto.nodeType && { nodeType: createChatDto.nodeType }),
    };
    
    const chat = await this.prisma.chat.create({ data: chatData });

    this.logger.log(`Successfully created chat with ID: ${chat.id}`);

    await this.initChatInRedis(chat);

    return chat;
  }

  async updateChat(id: string, updateChatDto: UpdateChatDto, organizationId: string) {
    this.logger.log(`Updating chat ${id} in organization ${organizationId}`);
    
    await this.getChat(id, organizationId);

    const updatedChat = await this.prisma.chat.update({
      where: { id },
      data: {
        ...(updateChatDto.name && { name: updateChatDto.name }),
        ...(updateChatDto.sessionType && { sessionType: updateChatDto.sessionType }),
        ...(updateChatDto.metadata && { metadata: updateChatDto.metadata }),
        updatedAt: new Date()
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
    
    const assistant = await this.prisma.assistant.findFirst({
      where: { id: assistantId, organizationId }
    });

    if (!assistant) {
      this.logger.error(`Assistant ${assistantId} not found in organization ${organizationId}`);
      throw new NotFoundException(`Assistant not found or not accessible in this organization`);
    }

    const where: Prisma.ChatWhereInput = {
      organizationId,
      assistantId,
      ...(filters?.sessionType && { sessionType: filters.sessionType }),
      ...(filters?.sessionId && { sessionId: filters.sessionId }),
      ...(filters?.agentId && { agentId: filters.agentId }),
      ...(filters?.workflowId && { workflowId: filters.workflowId }),
    };

    const chats = await this.prisma.chat.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          orderBy: { sequenceId: 'desc' },
          take: 1,
        }
      }
    });

    this.logger.log(`Found ${chats.length} chats for assistant ${assistantId}`);

    return chats.map(chat => ({
      ...chat,
      lastMessage: chat.messages[0]?.content || null
    }));
  }
  
  async getChatsByAgentId(organizationId: string, agentId: string, filters?: { sessionType?: string, sessionId?: string, workflowId?: string }) {
    this.logger.log(`Getting chats for agent ${agentId} in organization ${organizationId}`);
    if (filters) {
      this.logger.log(`Filters: ${JSON.stringify(filters)}`);
    }
    
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, organizationId }
    });

    if (!agent) {
      this.logger.error(`Agent ${agentId} not found in organization ${organizationId}`);
      throw new NotFoundException(`Agent not found or not accessible in this organization`);
    }

    const where: Prisma.ChatWhereInput = {
      organizationId,
      agentId,
      ...(filters?.sessionType && { sessionType: filters.sessionType }),
      ...(filters?.sessionId && { sessionId: filters.sessionId }),
      ...(filters?.workflowId && { workflowId: filters.workflowId }),
    };

    const chats = await this.prisma.chat.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          orderBy: { sequenceId: 'desc' },
          take: 1,
        }
      }
    });

    this.logger.log(`Found ${chats.length} chats for agent ${agentId}`);

    return chats.map(chat => ({
      ...chat,
      lastMessage: chat.messages[0]?.content || null
    }));
  }
  
  async getChatsByWorkflowId(organizationId: string, workflowId: string, filters?: { sessionType?: string, sessionId?: string, agentId?: string }) {
    this.logger.log(`Getting chats for workflow ${workflowId} in organization ${organizationId}`);
    if (filters) {
      this.logger.log(`Filters: ${JSON.stringify(filters)}`);
    }
    
    const workflow = await this.prisma.workflow.findFirst({
      where: { id: workflowId, organizationId }
    });

    if (!workflow) {
      this.logger.error(`Workflow ${workflowId} not found in organization ${organizationId}`);
      throw new NotFoundException(`Workflow not found or not accessible in this organization`);
    }

    const where: Prisma.ChatWhereInput = {
      organizationId,
      workflowId,
      ...(filters?.sessionType && { sessionType: filters.sessionType }),
      ...(filters?.sessionId && { sessionId: filters.sessionId }),
      ...(filters?.agentId && { agentId: filters.agentId }),
    };

    const chats = await this.prisma.chat.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          orderBy: { sequenceId: 'desc' },
          take: 1,
        }
      }
    });

    this.logger.log(`Found ${chats.length} chats for workflow ${workflowId}`);

    return chats.map(chat => ({
      ...chat,
      lastMessage: chat.messages[0]?.content || null
    }));
  }

  async getChat(id: string, organizationId: string) {
    this.logger.log(`Getting chat ${id} for organization ${organizationId}`);
    
    const chat = await this.prisma.chat.findUnique({
      where: { id },
      include: { assistant: true }
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
    
    const chat = await this.getChat(id, organizationId);

    await this.prisma.chat.delete({ where: { id } });

    this.logger.log(`Successfully deleted chat ${id}`);

    await this.removeChatFromRedis(chat);

    return { success: true };
  }

  async getChatMessages(chatId: string, organizationId: string) {
    this.logger.log(`Getting messages for chat ${chatId} in organization ${organizationId}`);
    
    await this.getChat(chatId, organizationId);

    const messages = await this.prisma.message.findMany({
      where: { chatId },
      orderBy: { sequenceId: 'asc' }
    });

    this.logger.log(`Found ${messages.length} messages for chat ${chatId}`);
    return messages;
  }

  async createMessage(chatId: string, createMessageDto: CreateMessageDto, organizationId: string) {
    this.logger.log(`Creating new message for chat ${chatId}`);
    
    const chat = await this.getChat(chatId, organizationId);

    const userMessage = await this.prisma.message.create({
      data: {
        chatId,
        content: createMessageDto.content,
        role: createMessageDto.role,
        type: createMessageDto.type || 'text',
        sequenceId: createMessageDto.sequenceId,
        metadata: createMessageDto.metadata || {},
      }
    });

    this.logger.log(`Successfully created user message ${userMessage.id} for chat ${chatId}`);

    await this.updateChatInRedis(chat, userMessage);

    await this.prisma.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() }
    });

    let systemPrompt: string | undefined = undefined;
    const temperature = this.configService.get<number>('N8N_DEFAULT_TEMPERATURE') || 0.7;

    if (createMessageDto.role === 'user') {
      if (chat.assistantId) {
        const assistant = await this.prisma.assistant.findUnique({ where: { id: chat.assistantId } }) as AssistantWithN8n;
        if (assistant?.webhookUrl) {
          try {
            await this.n8nWorkflowService.getOrCreateAssistantWorkflow(chat.assistantId, assistant.organizationId);
            this.logger.log(`Verified n8n workflow exists for assistant ${chat.assistantId}`);
          } catch (e) {
            this.logger.warn(`Error verifying n8n workflow for assistant ${chat.assistantId}: ${e.message}`);
          }
        }
      } else if (chat.agentId) {
        try {
          const primaryWorkflow = await this.prisma.workflow.findFirst({
            where: { agentId: chat.agentId },
            include: { workflowNodes: true },
          });
          
          if (primaryWorkflow) {
            const assistantNode = primaryWorkflow.workflowNodes.find(node => node.nodeType === 'ASSISTANT');
            if (assistantNode && assistantNode.parameters) {
              try {
                const nodeData = JSON.parse(assistantNode.parameters);
                if (nodeData.systemPrompt) {
                  systemPrompt = nodeData.systemPrompt;
                  this.logger.log(`Using system prompt from agent workflow: ${systemPrompt?.substring(0, 50)}...`);
                }
              } catch (error) {
                this.logger.error('Failed to parse workflow node parameters', error);
              }
            }
          }
        } catch (e) {
          this.logger.warn(`Error extracting system prompt from agent ${chat.agentId}: ${e.message}`);
        }
      }

      if (!systemPrompt) {
        const chatWithPrompt = chat as ChatWithSystemPrompt;
        systemPrompt = chatWithPrompt.systemPrompt || 'You are a helpful assistant.';
      }
      
      this.logger.log(`Processing message through n8n for chat ${chatId}`);
      
      const n8nResponse = await this.callN8nWebhook(
        {
          sessionId: chatId,
          systemPrompt,
          temperature,
          chatInput: createMessageDto.content
        },
        chat.assistantId,
        chat.agentId
      );
      
      if (n8nResponse) {
        const assistantMessage = await this.prisma.message.create({
          data: {
            chat: { connect: { id: chatId } },
            content: n8nResponse.output,
            role: 'assistant',
            type: 'text',
            sequenceId: createMessageDto.sequenceId + 1,
            metadata: n8nResponse.metadata
          }
        });
        await this.updateChatInRedis(chat, assistantMessage);
        return { userMessage, assistantMessage };
      }
    }

    return { userMessage, assistantMessage: null };
  }

  private async callN8nWebhook(data: { sessionId: string; systemPrompt: string; temperature: number; chatInput: string }, assistantId?: string | null, agentId?: string | null): Promise<N8nWebhookResponse | null> {
    let webhookUrl: string | null | undefined;

    if (assistantId) {
      const assistant = await this.prisma.assistant.findUnique({ where: { id: assistantId } }) as AssistantWithN8n;
      webhookUrl = assistant?.webhookUrl;
    } else if (agentId) {
      const agent = await this.prisma.agent.findUnique({ where: { id: agentId } }) as AgentWithN8n;
      webhookUrl = agent?.metadata?.webhookUrl;
    }

    if (!webhookUrl) {
      this.logger.warn(`No webhook URL found for assistant ${assistantId} or agent ${agentId}`);
      return null;
    }

    try {
      this.logger.log(`Calling n8n webhook: ${webhookUrl.replace(/\/\/[^:]+:[^@]+@/, '\/\/***:***@')}`);
      
      const response = await axios.post(webhookUrl, {
        sessionId: data.sessionId,
        systemPrompt: data.systemPrompt,
        temperature: data.temperature,
        chatInput: data.chatInput
      });
      
      this.logger.log(`Received response from n8n webhook with status ${response.status}`);
      
      return {
        output: response.data?.data?.[0]?.json?.output || response.data,
        metadata: response.data
      };
    } catch (error) {
      this.logger.error(`Error calling n8n webhook: ${(error as Error).message}`);
      
      if ((error as any).response) {
        this.logger.error(`n8n webhook response status: ${(error as any).response.status}`);
        this.logger.error(`n8n webhook response data: ${JSON.stringify((error as any).response.data)}`);
      }
      
      return null;
    }
  }

  private getRedisKey(chat: Chat): string {
    const { id: chatId, assistantId, agentId, sessionId } = chat;
    if (assistantId) return `chat:assistant:${assistantId}:${sessionId}`;
    if (agentId) return `chat:agent:${agentId}:${sessionId}`;
    return `chat:${chatId}:${sessionId}`;
  }

  private async initChatInRedis(chat: Chat): Promise<void> {
    const redisKey = this.getRedisKey(chat);
    try {
      await this.redis.set(redisKey, JSON.stringify([]));
      this.logger.log(`Initialized Redis chat history for ${redisKey}`);
    } catch (error) {
      this.logger.error(`Failed to initialize Redis chat history for ${redisKey}: ${(error as Error).message}`);
    }
  }

  private async updateChatInRedis(chat: Chat, message: Message): Promise<void> {
    const redisKey = this.getRedisKey(chat);
    try {
      const existingChatHistory = await this.redis.get(redisKey);
      let chatHistory: ChatHistoryMessage[] = [];
      
      if (existingChatHistory) {
        chatHistory = JSON.parse(existingChatHistory);
      }
      
      chatHistory.push({
        role: message.role,
        content: message.content,
        id: message.id,
        timestamp: message.createdAt
      });
      
      if (chatHistory.length > 2000) {
        chatHistory = chatHistory.slice(-2000);
      }
      
      await this.redis.set(redisKey, JSON.stringify(chatHistory));
      this.logger.log(`Updated Redis chat history for ${redisKey}`);
    } catch (error) {
      this.logger.error(`Failed to update Redis chat history for ${redisKey}: ${(error as Error).message}`);
    }
  }

  private async removeChatFromRedis(chat: Chat): Promise<void> {
    const redisKey = this.getRedisKey(chat);
    try {
      await this.redis.del(redisKey);
      this.logger.log(`Removed Redis chat history for ${redisKey}`);
    } catch (error) {
      this.logger.error(`Failed to remove Redis chat history for ${redisKey}: ${(error as Error).message}`);
    }
  }
}