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

  constructor(private readonly agentService: AgentService) {}

  @Post('query')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Process a query through the agent' })
  @ApiResponse({ status: 200, description: 'Query processed successfully' })
  async processQuery(@Body() request: AgentRequest): Promise<AgentResponse> {
    this.logger.log(`Processing agent query: ${request.input}`);
    return this.agentService.processRequest(request);
  }

  @Post('stream')
  @Public()
  @ApiOperation({ summary: 'Stream a query through the agent' })
  async streamQuery(@Req() req: Request, @Body() request: AgentRequest): Promise<StreamableFile> {
    this.logger.log(`Processing streaming agent query: ${request.input}`);
    this.logger.log(`Request details: ${JSON.stringify(request)}`);
    
    // Create a PassThrough stream to pipe the response
    const stream = new PassThrough();
    
    // Process the request asynchronously
    (async () => {
      try {
        // Get the streaming response from the agent service
        const agentStream = this.agentService.processStreamingRequest(request);
        
        // Write each chunk to the stream
        for await (const chunk of agentStream) {
          this.logger.log(`Received chunk: ${JSON.stringify(chunk)}`);
          // Format the chunk as SSE
          const sseData = `data: ${JSON.stringify(chunk)}\n\n`;
          stream.write(sseData);
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
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Check the health of the agent service' })
  @ApiResponse({ status: 200, description: 'Health check successful' })
  async healthCheck(): Promise<{ status: string; connected: boolean }> {
    const connected = await this.agentService.checkConnection();
    return {
      status: connected ? 'ok' : 'error',
      connected,
    };
  }
}
