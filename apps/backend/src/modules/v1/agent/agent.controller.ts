import { Body, Controller, Post, Req, UseGuards, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { Public } from '../../../core/auth/decorators/public.decorator';
import { AgentService } from '../../../integrations/agent/agent.service';
import { AgentRequest, AgentResponse } from '../../../integrations/agent/interfaces/agent.interface';
import { StreamableFile } from '@nestjs/common';
import { PassThrough } from 'stream';
import { ChatsService } from '../chats/chats.service';
import { CreateMessageDto } from '../chats/dto/create-message.dto';

// Define a custom interface for our streaming response
interface StreamResponse {
  data: any;
  id: string;
  type: string;
}

@Controller('v1/agent')
@ApiTags('Agent')
@ApiBearerAuth()
export class AgentController {
  private readonly logger = new Logger(AgentController.name);

  constructor(
    private readonly agentService: AgentService,
    private readonly chatsService: ChatsService
  ) {}

  @Post('query')
  @Public() // Make this endpoint public
  @ApiOperation({ summary: 'Process a query through the agent' })
  @ApiResponse({ status: 200, description: 'Query processed successfully' })
  async processQuery(@Body() request: AgentRequest, @Req() req: Request): Promise<AgentResponse> {
    this.logger.log(`Processing agent query: ${request.input}`);
    
    const response = await this.agentService.processRequest(request);
    
    // Save the messages to the database if we have a valid chat ID
    if (request.sessionId && !request.sessionId.startsWith('chat-')) {
      try {
        const organizationId = req.headers['x-organization-id'] as string;
        
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
    
    // Save the user message to the database if we have a valid chat ID
    if (request.sessionId && !request.sessionId.startsWith('chat-')) {
      try {
        const organizationId = req.headers['x-organization-id'] as string;
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
        const agentStream = this.agentService.processStreamingRequest(request);
        
        // Track the complete assistant response for saving to the database
        let completeAssistantResponse = '';
        
        // Write each chunk to the stream
        for await (const chunk of agentStream) {
          this.logger.log(`Received chunk: ${JSON.stringify(chunk)}`);
          
          // Extract the assistant's response from the chunk
          if (chunk.output && typeof chunk.output === 'string') {
            completeAssistantResponse = chunk.output;
          }
          
          // Format the chunk as SSE
          const sseData = `data: ${JSON.stringify(chunk)}\n\n`;
          stream.write(sseData);
        }
        
        // Save the complete assistant response to the database
        if (request.sessionId && !request.sessionId.startsWith('chat-') && completeAssistantResponse) {
          try {
            const organizationId = req.headers['x-organization-id'] as string;
            await this.saveMessageToDatabase(request.sessionId, completeAssistantResponse, 'assistant', organizationId);
          } catch (error) {
            this.logger.error(`Error saving assistant response to database: ${error.message}`);
          }
        }
        
        // End the stream when done
        this.logger.log('Stream completed successfully');
        stream.end();
      } catch (error) {
        this.logger.error(`Error in stream: ${error.message}`);
        if (error.stack) {
          this.logger.error(`Error stack: ${error.stack}`);
        }
        
        // Send error as SSE event
        const errorResponse = {
          error: true,
          message: error.message,
          output: `Error: ${error.message}`,
          sessionId: request.sessionId
        };
        
        this.logger.log(`Sending error response: ${JSON.stringify(errorResponse)}`);
        stream.write(`data: ${JSON.stringify(errorResponse)}\n\n`);
        stream.end();
      }
    })();
    
    // Return the stream as a StreamableFile with proper headers
    return new StreamableFile(stream, {
      type: 'text/event-stream',
      disposition: 'inline',
    });
  }

  @Post('health')
  @Public()
  @ApiOperation({ summary: 'Check the health of the agent service' })
  @ApiResponse({ status: 200, description: 'Health check successful' })
  async healthCheck(): Promise<{ status: string; connected: boolean }> {
    this.logger.log('Health check requested');
    const connected = await this.agentService.checkConnection();
    this.logger.log(`Health check result: ${connected ? 'connected' : 'disconnected'}`);
    return {
      status: connected ? 'ok' : 'error',
      connected,
    };
  }

  /**
   * Helper method to clean and parse message content
   * This handles complex JSON structures that might be embedded in the content
   */
  private cleanMessageContent(content: string): string {
    try {
      // If it's not a string that looks like JSON, return as is
      if (typeof content !== 'string' || (!content.includes('{') && !content.includes('['))) {
        return content;
      }

      // Try to extract JSON from the content
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
