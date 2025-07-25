import { Controller, Get, Post, Body, Param, Delete, Put, UseGuards, Req, BadRequestException, Logger, Query, HttpStatus, HttpCode } from '@nestjs/common';
import { AgentService } from '../services/agent.service';
import { AgentService as IntegrationsAgentService } from '../../../../integrations/agent/agent.service';
import { CreateAgentDto, UpdateAgentDto } from '../dto';
import { User } from '@prisma/client';
import { JwtAuthGuard } from '../../../../core/auth/guards/jwt-auth.guard';
import { OrgRoleGuard } from '../../../../core/auth/guards/org-role.guard';
import { Public } from '../../../../core/auth/decorators/public.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Agent } from '@prisma/client';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AgentRequest, AgentResponse } from '../../../../integrations/agent/interfaces/agent.interface';
import { StreamableFile } from '@nestjs/common';
import { PassThrough } from 'stream';
import { ChatsService } from '../../chats/chats.service';
import { WorkflowService } from '../../workflow/services/workflow.service';
import { PrismaService } from '../../../../core/database/prisma.service';
import { CreateMessageDto } from '../../chats/dto/create-message.dto';

// Define a custom interface for our streaming response
interface StreamResponse {
  data: any;
  id: string;
  type: string;
}

@ApiTags('agents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrgRoleGuard)
@Controller('v1/agents')
export class AgentController {
  private readonly logger = new Logger(AgentController.name);
  
  constructor(
    private readonly agentService: AgentService,
    private readonly integrationsAgentService: IntegrationsAgentService,
    private readonly chatsService: ChatsService,
    private readonly workflowService: WorkflowService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new agent' })
  @ApiResponse({ status: 201, description: 'The agent has been successfully created.' })
  create(@Body() createAgentDto: CreateAgentDto): Promise<Agent> {
    if (!createAgentDto.organizationId) {
      throw new BadRequestException('Organization ID is required');
    }
    return this.agentService.create(createAgentDto, createAgentDto.organizationId);
  }

  @Get()
  @ApiOperation({ summary: 'List all agents for the authenticated user or a specific organization' })
  @ApiResponse({ status: 200, description: 'Return all agents.' })
  findAll(@Req() req, @Query('organizationId') organizationId?: string) {
    // Use the organizationId from the query if provided, otherwise fall back to the user's last active organization.
    const orgId = organizationId || req.user.lastOrgId;
    if (!orgId) {
      throw new BadRequestException('Organization ID must be provided.');
    }
    // TODO: Add a check to ensure the user has access to the requested organizationId
    return this.agentService.findAll(orgId);
  }

  @Get('assistant/:assistantId')
  @ApiOperation({ summary: 'Get all agents for a specific assistant' })
  @ApiResponse({ status: 200, description: 'Return all agents for the assistant.' })
  findAllByAssistant(@Param('assistantId') assistantId: string, @Req() req): Promise<Agent[]> {
    const organizationId = (req.user as User).lastOrgId;
    if (!organizationId) {
      throw new BadRequestException('No organization selected');
    }
    return this.agentService.findAllByAssistant(assistantId, organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a agent by ID' })
  @ApiResponse({ status: 200, description: 'Return the agent.' })
  @ApiResponse({ status: 404, description: 'Agent not found.' })
  async findOne(@Param('id') id: string, @Req() req): Promise<any> {
    const organizationId = (req.user as User).lastOrgId;
    if (!organizationId) {
      throw new BadRequestException('No organization selected');
    }
    
    // Get the base agent data
    const agent = await this.agentService.findOne(id, organizationId);
    
    try {
      // Find and extract assistantId from workflow nodes if not already in agent
      if (!agent.assistantId) {
        this.logger.log(`Agent ${id} doesn't have assistantId. Looking for assistant node in workflow...`);
        
        try {
          // Get workflows for this agent
          const workflows = await this.workflowService.getAgentWorkflows(id, organizationId);
          this.logger.log(`Found ${workflows?.length || 0} workflows for agent ${id}`);
          
          // Look for ASSISTANT nodes in each workflow and extract assistantId
          for (const workflow of workflows) {
            try {
              this.logger.log(`[AGENT_ASSISTANT_DEBUG] Processing workflow ${workflow.id}`);
              let parsedNodes;
              try {
                parsedNodes = workflow.nodes ? (typeof workflow.nodes === 'string' ? JSON.parse(workflow.nodes) : workflow.nodes) : {};
                this.logger.log(`[AGENT_ASSISTANT_DEBUG] Successfully parsed workflow nodes, found ${Object.keys(parsedNodes).length} nodes`);
                this.logger.debug(`[AGENT_ASSISTANT_DEBUG] Node keys: ${Object.keys(parsedNodes).join(', ')}`);
              } catch (parseError) {
                this.logger.error(`[AGENT_ASSISTANT_DEBUG] Error parsing workflow nodes: ${parseError.message}`);
                this.logger.error(`[AGENT_ASSISTANT_DEBUG] Workflow nodes raw data: ${JSON.stringify(workflow.nodes).substring(0, 200)}...`);
                continue;
              }
              
              // Check for both assistantId and apiAssistantId fields that might exist in the node data
              const nodes = parsedNodes as Record<string, { type: string; data?: { assistantId?: string, apiAssistantId?: string } }>;
              
              // Find nodes with type ASSISTANT that have either assistantId or apiAssistantId
              const assistantNodes = Object.values(nodes).filter(node => 
                node.type === 'ASSISTANT' && (node.data?.assistantId || node.data?.apiAssistantId)
              );
              
              this.logger.log(`[AGENT_ASSISTANT_DEBUG] Found ${assistantNodes?.length || 0} ASSISTANT nodes in workflow ${workflow.id}`);
              
              if (assistantNodes.length > 0) {
                for (const assistantNode of assistantNodes) {
                  this.logger.log(`[AGENT_ASSISTANT_DEBUG] Found ASSISTANT node with data: ${JSON.stringify(assistantNode.data)}`);
                  
                  // Check both possible fields for the assistantId
                  const assistantId = assistantNode.data?.apiAssistantId || assistantNode.data?.assistantId;
                  
                  if (assistantId) {
                    this.logger.log(`[AGENT_ASSISTANT_DEBUG] Found assistantId ${assistantId} in workflow ${workflow.id} (field: ${assistantNode.data?.apiAssistantId ? 'apiAssistantId' : 'assistantId'})`);
                    agent.assistantId = assistantId;
                    break;
                  }
                }
                if (agent.assistantId) break; // Exit the workflow loop if we found an assistantId
              } else {
                this.logger.log(`[AGENT_ASSISTANT_DEBUG] No ASSISTANT nodes found with assistantId/apiAssistantId in workflow ${workflow.id}`);
              }
            } catch (error) {
              this.logger.error(`[AGENT_ASSISTANT_DEBUG] Error processing workflow ${workflow.id}: ${error.message}`);
            }
          }
          
          // Check if we successfully extracted an assistantId
          if (!agent.assistantId) {
            this.logger.warn(`[AGENT_ASSISTANT_DEBUG] Failed to extract assistantId from any workflow for agent ${id}`);
          }
        } catch (error) {
          this.logger.warn(`[AGENT_ASSISTANT_DEBUG] Error getting workflows for agent ${id}: ${error.message}`, error.stack);
          // Continue without assistantId
        }
      } else {
        this.logger.log(`[AGENT_ASSISTANT_DEBUG] Agent ${id} already has assistantId ${agent.assistantId}`);
      }
      
      // Check if any workflows for this agent are published
      const workflows = await this.prisma.workflow.findMany({
        where: {
          agentId: id,
          isPublished: true
        }
      });
      
      // If we have at least one published workflow, consider the agent published
      const isPublished = workflows.length > 0;
      
      // Return agent with additional workflow publication status
      return {
        ...agent,
        isPublished: isPublished
      };
    } catch (error) {
      this.logger.error(`Error checking workflow publication status: ${error.message}`);
      // Return the agent without workflow status in case of error
      return agent;
    }
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a agent' })
  @ApiResponse({ status: 200, description: 'The agent has been successfully updated.' })
  @ApiResponse({ status: 404, description: 'Agent not found.' })
  update(
    @Param('id') id: string,
    @Body() updateAgentDto: UpdateAgentDto,
    @Req() req,
  ): Promise<Agent> {
    const organizationId = (req.user as User).lastOrgId;
    if (!organizationId) {
      throw new BadRequestException('No organization selected');
    }
    return this.agentService.update(id, updateAgentDto, organizationId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a agent' })
  @ApiResponse({ status: 200, description: 'The agent has been successfully deleted.' })
  @ApiResponse({ status: 404, description: 'Agent not found.' })
  remove(@Param('id') id: string, @Req() req): Promise<Agent> {
    const organizationId = (req.user as User).lastOrgId;
    if (!organizationId) {
      throw new BadRequestException('No organization selected');
    }
    return this.agentService.remove(id, organizationId);
  }

  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish a agent' })
  @ApiResponse({ status: 200, description: 'The agent has been successfully published.' })
  @ApiResponse({ status: 404, description: 'Agent not found.' })
  publish(@Param('id') id: string, @Req() req): Promise<Agent> {
    const organizationId = (req.user as User).lastOrgId;
    if (!organizationId) {
      throw new BadRequestException('No organization selected');
    }
    return this.agentService.publish(id, organizationId);
  }

  @Post(':id/unpublish')
  @ApiOperation({ summary: 'Unpublish a agent' })
  @ApiResponse({ status: 200, description: 'The agent has been successfully unpublished.' })
  @ApiResponse({ status: 404, description: 'Agent not found.' })
  unpublish(@Param('id') id: string, @Req() req): Promise<Agent> {
    const organizationId = (req.user as User).lastOrgId;
    if (!organizationId) {
      throw new BadRequestException('No organization selected');
    }
    return this.agentService.unpublish(id, organizationId);
  }

  // Agent query processing endpoints

  @Post('query')
  @Public() // Make this endpoint public
  @ApiOperation({ summary: 'Process a query through the agent' })
  @ApiResponse({ status: 200, description: 'Query processed successfully' })
  async processQuery(@Body() request: AgentRequest, @Req() req: Request): Promise<AgentResponse> {
    this.logger.log(`Processing agent query: ${request.input}`);
    
    // If assistantId is specified, check if it's actually an agent ID
    if (request.config?.assistantId) {
      try {
        this.logger.log(`[AGENT_ASSISTANT_DEBUG] Checking if assistantId ${request.config.assistantId} is actually an agentId...`);
        const organizationId = (req.user as User)?.lastOrgId || (req.headers['x-organization-id'] as string);
        
        // Try to find an agent with this ID
        try {
          const agent = await this.agentService.findOne(request.config.assistantId, organizationId);
          
          if (agent) {
            this.logger.log(`[AGENT_ASSISTANT_DEBUG] ID ${request.config.assistantId} is an agent ID. This is a workflow agent request.`);
            
            // Properly mark as a workflow agent request
            if (!request.config) request.config = {};
            request.config.workflowAgent = true;
            
            // Log the updated request configuration
            this.logger.log(`[AGENT_ASSISTANT_DEBUG] Updated request config: ${JSON.stringify(request.config)}`);
          }
        } catch (agentError) {
          // Not an agent ID, proceed normally
          this.logger.log(`[AGENT_ASSISTANT_DEBUG] ID ${request.config.assistantId} is not an agent ID. Proceeding with normal assistant request.`);
        }
      } catch (error) {
        this.logger.error(`[AGENT_ASSISTANT_DEBUG] Error checking if assistantId is actually an agentId: ${error.message}`);
        // Continue with processing even if checking fails
      }
    }
    
    const response = await this.integrationsAgentService.processRequest(request);
    
    // Save the messages to the database if we have a valid chat ID
    if (request.sessionId && !request.sessionId.startsWith('chat-')) {
      try {
        const organizationId = (req.user as User)?.lastOrgId || (req.headers['x-organization-id'] as string);
        
        // Save user message
        await this.saveMessageToDatabase(request.sessionId, request.input, 'user', organizationId);
        
        // Save assistant response
        if (response && response.output) {
          await this.saveMessageToDatabase(request.sessionId, response.output, 'assistant', organizationId);
        }
      } catch (error) {
        this.logger.error(`Error saving messages to database: ${error.message}`);
        // Continue with the response even if saving fails
      }
    }
    
    return response;
  }

  @Post('stream')
  @Public()
  @ApiOperation({ summary: 'Stream a query through the agent' })
  async streamQuery(@Req() req: Request, @Body() request: AgentRequest): Promise<StreamableFile> {
    this.logger.log(`Processing streaming agent query: ${request.input}`);
    this.logger.log(`Request details: ${JSON.stringify(request)}`);
    
    // If assistantId is specified, check if it's actually an agent ID
    if (request.config?.assistantId) {
      try {
        this.logger.log(`[AGENT_ASSISTANT_DEBUG] Checking if assistantId ${request.config.assistantId} is actually an agentId...`);
        const organizationId = (req.user as User)?.lastOrgId || (req.headers['x-organization-id'] as string);
        
        // Try to find an agent with this ID
        try {
          const agent = await this.agentService.findOne(request.config.assistantId, organizationId);
          
          if (agent) {
            this.logger.log(`[AGENT_ASSISTANT_DEBUG] ID ${request.config.assistantId} is an agent ID. This is a workflow agent request.`);
            
            // Properly mark as a workflow agent request
            if (!request.config) request.config = {};
            request.config.workflowAgent = true;
            
            // Log the updated request configuration
            this.logger.log(`[AGENT_ASSISTANT_DEBUG] Updated request config: ${JSON.stringify(request.config)}`);
          }
        } catch (agentError) {
          // Not an agent ID, proceed normally
          this.logger.log(`[AGENT_ASSISTANT_DEBUG] ID ${request.config.assistantId} is not an agent ID. Proceeding with normal assistant request.`);
        }
      } catch (error) {
        this.logger.error(`[AGENT_ASSISTANT_DEBUG] Error checking if assistantId is actually an agentId: ${error.message}`);
        // Continue with the streaming response even if checking fails
      }
    }
    
    // Save the user message to the database if we have a valid chat ID
    if (request.sessionId && !request.sessionId.startsWith('chat-')) {
      try {
        const organizationId = (req.user as User)?.lastOrgId || (req.headers['x-organization-id'] as string);
        await this.saveMessageToDatabase(request.sessionId, request.input, 'user', organizationId);
      } catch (error) {
        this.logger.error(`Error saving user message to database: ${error.message}`);
        // Continue with the streaming response even if saving fails
      }
    }
    
    // Create a PassThrough stream to pipe the response
    const stream = new PassThrough();
    
    // Process the request asynchronously
    (async () => {
      try {
        // Get the streaming response from the agent service
        const agentStream = this.integrationsAgentService.processStreamingRequest(request);
        
        // Track the complete assistant response for saving to the database
        let completeAssistantResponse = '';
        
        // Write each chunk to the stream
        for await (const chunk of agentStream) {
          this.logger.log(`Received chunk: ${JSON.stringify(chunk)}`);
          
          // Format the chunk as a Server-Sent Event
          const eventData: StreamResponse = {
            data: chunk,
            id: Date.now().toString(),
            type: 'chunk'
          };
          
          const eventString = `data: ${JSON.stringify(eventData)}\n\n`;
          stream.write(eventString);
          
          // Accumulate the response for database storage
          if (typeof chunk === 'string') {
            completeAssistantResponse += chunk;
          } else if (chunk && chunk.output && typeof chunk.output === 'string') {
            completeAssistantResponse += chunk.output;
          } else if (chunk && typeof chunk === 'object' && 'text' in chunk && typeof chunk.text === 'string') {
            completeAssistantResponse += chunk.text;
          } else {
            try {
              // Try to stringify the chunk if it's an object
              const jsonChunk = JSON.stringify(chunk);
              completeAssistantResponse += jsonChunk;
            } catch (e) {
              this.logger.warn('Could not stringify chunk for accumulation');
            }
          }
        }
        
        // Save the complete assistant response to the database
        if (request.sessionId && !request.sessionId.startsWith('chat-')) {
          try {
            const organizationId = (req.user as User)?.lastOrgId || (req.headers['x-organization-id'] as string);
            await this.saveMessageToDatabase(
              request.sessionId,
              completeAssistantResponse,
              'assistant',
              organizationId
            );
          } catch (error) {
            this.logger.error(`Error saving complete assistant response: ${error.message}`);
          }
        }
        
        // Send a final event to indicate completion
        const finalEvent: StreamResponse = {
          data: { complete: true },
          id: Date.now().toString(),
          type: 'complete'
        };
        stream.write(`data: ${JSON.stringify(finalEvent)}\n\n`);
        
        // End the stream
        stream.end();
      } catch (error) {
        this.logger.error(`Error processing streaming request: ${error.message}`);
        
        // Send an error event
        const errorEvent: StreamResponse = {
          data: { error: error.message },
          id: Date.now().toString(),
          type: 'error'
        };
        stream.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
        
        // End the stream
        stream.end();
      }
    })();
    
    // Return the stream as a StreamableFile
    return new StreamableFile(stream, {
      type: 'text/event-stream',
      disposition: 'inline',
    });
  }

  @Get(':id/workflows')
  @ApiOperation({ summary: 'Get all workflows for an agent' })
  @ApiResponse({ status: 200, description: 'Return all workflows for the agent.' })
  async getAgentWorkflows(@Param('id') id: string, @Req() req): Promise<any[]> {
    const organizationId = (req.user as User).lastOrgId;
    if (!organizationId) {
      throw new BadRequestException('No organization selected');
    }
    console.log(`Getting workflows for agent ${id} in organization ${organizationId}`);
    // Use WorkflowService instead of AgentService for workflow operations
    return this.workflowService.getAgentWorkflows(id, organizationId);
  }

  // Secondary workflow creation moved to WorkflowController

  @Get('health-check')
  @ApiOperation({ summary: 'Check if the agent service is running properly' })
  @Public()
  @ApiResponse({ status: 200, description: 'Agent service is running.' })
  @ApiResponse({ status: 500, description: 'Agent service is not running.' })
  async healthCheck(): Promise<{ status: string; connected: boolean }> {
    try {
      // Simple health check
      return {
        status: 'ok',
        connected: true,
      };
    } catch (error) {
      return {
        status: 'error: ' + error.message,
        connected: false,
      };
    }
  }

  @Post('health')
  @Public()
  @ApiOperation({ summary: 'Check agent service health' })
  async healthCheckAgent(): Promise<{ status: string; connected: boolean }> {
    try {
      // Check connection to the agent service
      const connected = await this.integrationsAgentService.checkConnection();
      return {
        status: connected ? 'ok' : 'error',
        connected
      };
    } catch (error) {
      return { status: 'error', connected: false };
    }
  }

  // Helper method to clean and parse message content
  // This handles complex JSON structures that might be embedded in the content
  // and removes trailing JSON metadata from assistant messages
  private cleanMessageContent(content: string): string {
    try {
      // If content is empty or not a string, return as is
      if (!content || typeof content !== 'string') {
        return content;
      }
      
      // Check for trailing JSON metadata pattern (common in assistant responses)
      // This regex matches JSON objects at the end of a string that look like chunk metadata
      const trailingJsonRegex = /(\{"output":.*?"metadata":.*?\})$/;
      if (trailingJsonRegex.test(content)) {
        this.logger.log(`[AGENT_ASSISTANT_DEBUG] Removing trailing JSON metadata from message`);
        return content.replace(trailingJsonRegex, '');
      }
      
      // If content is already a reasonable length, don't try to parse it
      if (content.length < 500 && !content.includes('{') && !content.includes('[')) {
        return content;
      }
      
      let jsonContent: any;
      try {
        // First try to parse the entire content as JSON
        jsonContent = JSON.parse(content);
      } catch (e) {
        // If that fails, try to find JSON within the string
        const jsonMatch = content.match(/\{.*\}|\[.*\]/s);
        if (jsonMatch) {
          try {
            jsonContent = JSON.parse(jsonMatch[0]);
          } catch (innerError) {
            // If parsing fails, return original content
            return content;
          }
        } else {
          // No JSON found, return original content
          return content;
        }
      }

      // Now extract the actual message from the JSON structure
      if (jsonContent) {
        // Handle session_id structure with outputs
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

        // Handle direct message property
        if (jsonContent.message && typeof jsonContent.message === 'string') {
          return jsonContent.message;
        }

        // Handle text property
        if (jsonContent.text && typeof jsonContent.text === 'string') {
          return jsonContent.text;
        }
      }

      // If we couldn't extract a clean message, return the original content
      return content;
    } catch (error) {
      this.logger.error(`Error cleaning message content: ${error.message}`);
      // Return original content if cleaning fails
      return content;
    }
  }

  // Helper method to save messages to the database
  private async saveMessageToDatabase(chatId: string, content: string, role: 'user' | 'assistant', organizationId: string): Promise<void> {
    try {
      // Skip if we don't have a valid chat ID or organization ID
      if (!chatId || !organizationId) {
        this.logger.warn(`Cannot save message: Missing chatId (${chatId}) or organizationId (${organizationId})`);
        return;
      }
      
      this.logger.log(`Saving ${role} message to database for chat ${chatId}`);
      
      // Clean the message content before saving
      const cleanedContent = this.cleanMessageContent(content);
      this.logger.log(`Original content length: ${content.length}, Cleaned content length: ${cleanedContent.length}`);
      
      // Get the next sequence ID
      let sequenceId = 0;
      try {
        const messages = await this.chatsService.getChatMessages(chatId, organizationId);
        if (Array.isArray(messages) && messages.length > 0) {
          // Find the highest sequence ID and add 1
          sequenceId = Math.max(...messages.map(m => m.sequenceId)) + 1;
          this.logger.log(`Determined sequence ID from existing messages: ${sequenceId}`);
        }
      } catch (error) {
        // If we can't get existing messages, use a timestamp-based ID
        sequenceId = Math.floor(Date.now() / 1000) % 10000; // Convert to seconds and keep only last 4 digits
        this.logger.log(`Using fallback sequence ID: ${sequenceId}`);
      }
      
      // Create the message DTO
      const messageDto: CreateMessageDto = {
        content: cleanedContent,
        role,
        sequenceId,
        type: 'text'
      };
      
      // Save the message
      await this.chatsService.createMessage(chatId, messageDto, organizationId);
      this.logger.log(`Successfully saved ${role} message to database for chat ${chatId}`);
    } catch (error) {
      this.logger.error(`Error saving message to database: ${error.message}`);
      throw error;
    }
  }
}
