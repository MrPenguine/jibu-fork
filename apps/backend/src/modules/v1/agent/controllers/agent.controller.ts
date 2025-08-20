import { Controller, Get, Post, Put, Body, Param, Delete, UseGuards, Query, Req, BadRequestException, NotFoundException, Logger, StreamableFile } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ExtendedAgent } from '../interfaces/agent.interface';
import { AgentService } from '../services/agent.service';
import { AgentService as IntegrationsAgentService } from '../../../../integrations/agent/agent.service';
import { CreateAgentDto, UpdateAgentDto } from '../dto';
import { JwtAuthGuard } from '../../../../core/auth/guards/jwt-auth.guard';
import { WorkspaceMemberGuard } from '../../../../core/auth/guards/workspace-member.guard';
import { Public } from '../../../../core/auth/decorators/public.decorator';
import { Request } from 'express';
import { AgentRequest, AgentResponse } from '../../../../integrations/agent/interfaces/agent.interface';
import { PassThrough } from 'stream';
import { ChatsService } from '../../chats/chats.service';
import { WorkflowService } from '../../workflow/services/workflow.service';
import { CreateMessageDto } from '../../chats/dto/create-message.dto';

// Define a custom interface for our streaming response
interface StreamResponse {
  data: any;
  id: string;
  type: string;
}

// Auth payload placed on req.user by the auth guard/strategy
interface AuthUser {
  lastWorkspaceId?: string;
  [key: string]: any;
}

@ApiTags('agents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
@Controller('v1/agents')
export class AgentController {
  private readonly logger = new Logger(AgentController.name);
  
  constructor(
    private readonly agentService: AgentService,
    private readonly integrationsAgentService: IntegrationsAgentService,
    private readonly chatsService: ChatsService,
    private readonly workflowService: WorkflowService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new agent' })
  @ApiResponse({ status: 201, description: 'The agent has been successfully created.' })
  create(@Body() createAgentDto: CreateAgentDto, @Req() req): Promise<ExtendedAgent> {
    const workspaceId = req.user.lastWorkspaceId;
    if (!workspaceId) {
      throw new BadRequestException('Workspace ID is required');
    }
    return this.agentService.create(createAgentDto, workspaceId);
  }

  @Get()
  @ApiOperation({ summary: 'List all agents for the authenticated user or a specific workspace' })
  @ApiResponse({ status: 200, description: 'Return all agents.' })
  findAll(@Req() req, @Query('workspaceId') workspaceId?: string) {
    const id = workspaceId || req.user.lastWorkspaceId;
    if (!id) {
      throw new BadRequestException('Workspace ID must be provided.');
    }
    return this.agentService.findAll(id);
  }

  @Get('assistant/:assistantId')
  @ApiOperation({ summary: 'Get all agents for a specific assistant' })
  @ApiResponse({ status: 200, description: 'Return all agents for the assistant.' })
  findAllByAssistant(@Param('assistantId') assistantId: string, @Req() req): Promise<ExtendedAgent[]> {
    const workspaceId = req.user.lastWorkspaceId;
    if (!workspaceId) {
      throw new BadRequestException('No workspace selected');
    }
    return this.agentService.findAllByAssistant(assistantId, workspaceId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a agent by ID' })
  @ApiResponse({ status: 200, description: 'Return the agent.' })
  @ApiResponse({ status: 404, description: 'Agent not found.' })
  async findOne(@Param('id') id: string, @Req() req): Promise<any> {
    const workspaceId = req.user.lastWorkspaceId;
    if (!workspaceId) {
      throw new BadRequestException('No workspace selected');
    }
    const agent = await this.agentService.findOne(id, workspaceId);
    if (!agent) {
      throw new NotFoundException(`Agent with ID ${id} not found`);
    }

    const workflows = await this.workflowService.getAgentWorkflows(id, workspaceId);
    const chats = await this.chatsService.getChatsByAgentId(workspaceId, id);

    return {
      ...agent,
      workflows,
      chats,
    };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a agent' })
  @ApiResponse({ status: 200, description: 'The agent has been successfully updated.' })
  @ApiResponse({ status: 404, description: 'Agent not found.' })
  update(
    @Param('id') id: string,
    @Body() updateAgentDto: UpdateAgentDto,
    @Req() req,
  ): Promise<ExtendedAgent> {
    const workspaceId = req.user.lastWorkspaceId;
    if (!workspaceId) {
      throw new BadRequestException('No workspace selected');
    }
    return this.agentService.update(id, updateAgentDto, workspaceId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a agent' })
  @ApiResponse({ status: 200, description: 'The agent has been successfully deleted.' })
  @ApiResponse({ status: 404, description: 'Agent not found.' })
  remove(@Param('id') id: string, @Req() req): Promise<ExtendedAgent> {
    const workspaceId = req.user.lastWorkspaceId;
    if (!workspaceId) {
      throw new BadRequestException('No workspace selected');
    }
    return this.agentService.remove(id, workspaceId);
  }

  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish a agent' })
  @ApiResponse({ status: 200, description: 'The agent has been successfully published.' })
  @ApiResponse({ status: 404, description: 'Agent not found.' })
  publish(@Param('id') id: string, @Req() req): Promise<ExtendedAgent> {
    const workspaceId = req.user.lastWorkspaceId;
    if (!workspaceId) {
      throw new BadRequestException('No workspace selected');
    }
    return this.agentService.publish(id, workspaceId);
  }

  @Post(':id/unpublish')
  @ApiOperation({ summary: 'Unpublish a agent' })
  @ApiResponse({ status: 200, description: 'The agent has been successfully unpublished.' })
  @ApiResponse({ status: 404, description: 'Agent not found.' })
  unpublish(@Param('id') id: string, @Req() req): Promise<ExtendedAgent> {
    const workspaceId = req.user.lastWorkspaceId;
    if (!workspaceId) {
      throw new BadRequestException('No workspace selected');
    }
    return this.agentService.unpublish(id, workspaceId);
  }

  @Get(':id/workflows')
  @ApiOperation({ summary: 'Get all workflows for an agent' })
  @ApiResponse({ status: 200, description: 'Return all workflows for the agent.' })
  async getAgentWorkflows(@Param('id') id: string, @Req() req): Promise<any[]> {
    const workspaceId = req.user.lastWorkspaceId;
    if (!workspaceId) {
      throw new BadRequestException('No workspace selected');
    }
    this.logger.log(`Getting workflows for agent ${id} in workspace ${workspaceId}`);
    return this.workflowService.getAgentWorkflows(id, workspaceId);
  }

  // Agent query processing endpoints

  @Post('query')
  @Public() // Make this endpoint public
  @ApiOperation({ summary: 'Process a query through the agent' })
  @ApiResponse({ status: 200, description: 'Query processed successfully' })
  async processQuery(@Body() request: AgentRequest, @Req() req: Request): Promise<AgentResponse> {
    this.logger.log(`Processing agent query: ${request.input}`);

    const workspaceId = (req.user as AuthUser)?.lastWorkspaceId || (req.headers['x-workspace-id'] as string);

    if (request.config?.assistantId && workspaceId) {
      try {
        const agent = await this.agentService.findOne(request.config.assistantId, workspaceId);
        if (agent) {
          if (!request.config) request.config = {};
          request.config.workflowAgent = true;
        }
      } catch (error) {
        // Not an agent ID or other error, proceed normally
      }
    }

    const response = await this.integrationsAgentService.processRequest(request);

    if (request.sessionId && !request.sessionId.startsWith('chat-') && workspaceId) {
      try {
        await this.saveMessageToDatabase(request.sessionId, request.input, 'user', workspaceId);
        if (response && response.output) {
          await this.saveMessageToDatabase(request.sessionId, response.output, 'assistant', workspaceId);
        }
      } catch (error) {
        this.logger.error(`Error saving messages to database: ${error.message}`);
      }
    }

    return response;
  }

  @Post('stream')
  @Public()
  @ApiOperation({ summary: 'Stream a query through the agent' })
  async streamQuery(@Req() req: Request, @Body() request: AgentRequest): Promise<StreamableFile> {
    this.logger.log(`Processing streaming agent query: ${request.input}`);

    const workspaceId = (req.user as AuthUser)?.lastWorkspaceId || (req.headers['x-workspace-id'] as string);

    if (request.config?.assistantId && workspaceId) {
      try {
        const agent = await this.agentService.findOne(request.config.assistantId, workspaceId);
        if (agent) {
          if (!request.config) request.config = {};
          request.config.workflowAgent = true;
        }
      } catch (error) {
        // Not an agent ID or other error, proceed normally
      }
    }

    if (request.sessionId && !request.sessionId.startsWith('chat-') && workspaceId) {
      try {
        await this.saveMessageToDatabase(request.sessionId, request.input, 'user', workspaceId);
      } catch (error) {
        this.logger.error(`Error saving user message to database: ${error.message}`);
      }
    }
    
    const stream = new PassThrough();
    
    (async () => {
      try {
        const agentStream = this.integrationsAgentService.processStreamingRequest(request);
        let completeAssistantResponse = '';
        
        for await (const chunk of agentStream) {
          const eventData: StreamResponse = { data: chunk, id: Date.now().toString(), type: 'chunk' };
          stream.write(`data: ${JSON.stringify(eventData)}\n\n`);
          
          if (typeof chunk === 'string') {
            completeAssistantResponse += chunk;
          } else if (chunk?.output && typeof chunk.output === 'string') {
            completeAssistantResponse += chunk.output;
          } else {
            try {
              completeAssistantResponse += JSON.stringify(chunk);
            } catch (e) {
              this.logger.warn('Could not stringify chunk for accumulation');
            }
          }
        }
        
        if (request.sessionId && !request.sessionId.startsWith('chat-') && workspaceId) {
          try {
            await this.saveMessageToDatabase(request.sessionId, completeAssistantResponse, 'assistant', workspaceId);
          } catch (error) {
            this.logger.error(`Error saving complete assistant response: ${error.message}`);
          }
        }
        
        const finalEvent: StreamResponse = { data: { complete: true }, id: Date.now().toString(), type: 'complete' };
        stream.write(`data: ${JSON.stringify(finalEvent)}\n\n`);
        stream.end();
      } catch (error) {
        this.logger.error(`Error processing streaming request: ${error.message}`);
        const errorEvent: StreamResponse = { data: { error: error.message }, id: Date.now().toString(), type: 'error' };
        stream.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
        stream.end();
      }
    })();
    
    return new StreamableFile(stream, { type: 'text/event-stream', disposition: 'inline' });
  }

  @Get('health-check')
  @Public()
  @ApiOperation({ summary: 'Check if the agent service is running properly' })
  @ApiResponse({ status: 200, description: 'Agent service is running.' })
  @ApiResponse({ status: 500, description: 'Agent service is not running.' })
  async healthCheck(): Promise<{ status: string; connected: boolean }> {
    try {
      return { status: 'ok', connected: true };
    } catch (error) {
      return { status: 'error: ' + error.message, connected: false };
    }
  }

  @Post('health')
  @Public()
  @ApiOperation({ summary: 'Check agent service health' })
  async healthCheckAgent(): Promise<{ status: string; connected: boolean }> {
    try {
      const connected = await this.integrationsAgentService.checkConnection();
      return { status: connected ? 'ok' : 'error', connected };
    } catch (error) {
      return { status: 'error', connected: false };
    }
  }

  private cleanMessageContent(content: string): string {
    try {
      if (!content || typeof content !== 'string') return content;
      
      const trailingJsonRegex = /(\{"output":.*?\"metadata\":.*?\})$/;
      if (trailingJsonRegex.test(content)) {
        return content.replace(trailingJsonRegex, '');
      }
      
      if (content.length < 500 && !content.includes('{') && !content.includes('[')) {
        return content;
      }
      
      let jsonContent: any;
      try {
        jsonContent = JSON.parse(content);
      } catch (e) {
        const jsonMatch = content.match(/\{.*\}|\[.*\]/s);
        if (jsonMatch) {
          try {
            jsonContent = JSON.parse(jsonMatch[0]);
          } catch (innerError) {
            return content;
          }
        } else {
          return content;
        }
      }

      if (jsonContent) {
        if (jsonContent.session_id && jsonContent.outputs && Array.isArray(jsonContent.outputs)) {
          const firstOutput = jsonContent.outputs[0];
          if (firstOutput?.outputs?.[0]?.results?.message?.text) {
            return firstOutput.outputs[0].results.message.text;
          }
          if (firstOutput?.outputs?.[0]?.artifacts?.message) {
            return firstOutput.outputs[0].artifacts.message;
          }
          if (firstOutput?.inputs?.input_value) {
            return firstOutput.inputs.input_value;
          }
        }

        if (jsonContent.message && typeof jsonContent.message === 'string') return jsonContent.message;
        if (jsonContent.text && typeof jsonContent.text === 'string') return jsonContent.text;
      }

      return content;
    } catch (error) {
      this.logger.error(`Error cleaning message content: ${error.message}`);
      return content;
    }
  }

  private async saveMessageToDatabase(chatId: string, content: string, role: 'user' | 'assistant', workspaceId: string): Promise<void> {
    try {
      if (!chatId || !workspaceId) {
        this.logger.warn(`Cannot save message: Missing chatId (${chatId}) or workspaceId (${workspaceId})`);
        return;
      }
      
      const cleanedContent = this.cleanMessageContent(content);
      
      let sequenceId = 0;
      try {
        const messages = await this.chatsService.getChatMessages(chatId, workspaceId);
        if (Array.isArray(messages) && messages.length > 0) {
          sequenceId = Math.max(...messages.map(m => m.sequenceId)) + 1;
        }
      } catch (error) {
        sequenceId = Math.floor(Date.now() / 1000) % 10000;
      }
      
      const messageDto: CreateMessageDto = { content: cleanedContent, role, sequenceId, type: 'text' };
      
      await this.chatsService.createMessage(chatId, messageDto, workspaceId);
      this.logger.log(`Successfully saved ${role} message to database for chat ${chatId}`);
    } catch (error) {
      this.logger.error(`Error saving message to database: ${error.message}`);
      throw error;
    }
  }
}
