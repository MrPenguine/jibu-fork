import { Controller, Get, Post, Body, Param, Put, Delete, Logger, Res, Header } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { N8nService } from './n8n.service';
import { WebhookWorkflowTemplate } from './n8n.types';
import { Response } from 'express';
import { Observable } from 'rxjs';

interface TestWebhookDto {
  webhookUrl: string;
  workflowId?: string;
  testData?: any;
}

@ApiTags('n8n')
@Controller('v1/n8n')
export class N8nController {
  private readonly logger = new Logger(N8nController.name);

  constructor(
    private readonly n8nService: N8nService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Check n8n connection status' })
  async checkStatus() {
    return this.n8nService.checkStatus();
  }

  @Get('workflows')
  @ApiOperation({ summary: 'Get all n8n workflows' })
  async getAllWorkflows() {
    return this.n8nService.getAllWorkflows();
  }

  @Post('workflows')
  @ApiOperation({ summary: 'Create a new webhook workflow in n8n' })
  async createWebhookWorkflow(@Body() template: WebhookWorkflowTemplate) {
    return this.n8nService.createWebhookWorkflow(template);
  }

  @Get('workflows/:id')
  @ApiOperation({ summary: 'Get a workflow by ID' })
  async getWorkflow(@Param('id') id: string) {
    return this.n8nService.getWorkflow(id);
  }

  @Delete('workflows/:id')
  @ApiOperation({ summary: 'Delete a workflow by ID' })
  async deleteWorkflow(@Param('id') id: string) {
    return this.n8nService.deleteWorkflow(id);
  }

  @Post('workflows/:id/activate')
  @ApiOperation({ summary: 'Activate a workflow by ID' })
  async activateWorkflow(@Param('id') id: string) {
    return this.n8nService.activateWorkflow(id);
  }

  @Post('workflows/:id/deactivate')
  @ApiOperation({ summary: 'Deactivate a workflow by ID' })
  async deactivateWorkflow(@Param('id') id: string) {
    return this.n8nService.deactivateWorkflow(id);
  }

  @Put('workflows/:id/agent-prompt')
  @ApiOperation({ summary: 'Update the AI agent prompt in a workflow' })
  async updateAgentPrompt(@Param('id') id: string, @Body() data: { prompt: string }) {
    return this.n8nService.updateAgentPrompt(id, data.prompt);
  }
  
  @Post('workflows/:id/finalize-setup')
  @ApiOperation({ summary: 'Polls the webhook until it is fully registered and ready' })
  async finalizeWebhookSetup(@Param('id') id: string) {
    return this.n8nService.finalizeWebhookSetup(id);
  }

  @Post('test-webhook')
  @ApiOperation({ summary: 'Test a webhook by sending a request to it' })
  async testWebhook(
    @Body() body: { 
      webhookUrl: string; 
      workflowId?: string; 
      testData?: any;
      headers?: Record<string, string>;
      useTestUrl?: boolean;
    },
  ) {
    return this.n8nService.testWebhook(
      body.webhookUrl,
      body.workflowId,
      body.testData,
      body.headers,
      body.useTestUrl,
    );
  }

  @Post('stream-webhook')
  @ApiOperation({ summary: 'Send a request to a webhook and stream the response back as SSE' })
  @Header('Content-Type', 'text/event-stream')
  @Header('Cache-Control', 'no-cache')
  @Header('Connection', 'keep-alive')
  async streamWebhook(
    @Body() body: { 
      webhookUrl: string; 
      workflowId?: string; 
      message: string;
      sessionId: string;
      systemPrompt?: string;
      contextLength?: number;
      headers?: Record<string, string>;
    },
    @Res() response: Response,
  ) {
    this.logger.log(`Streaming webhook request to ${body.webhookUrl}`);  
    
    try {
      const stream = await this.n8nService.streamWebhook(
        body.webhookUrl,
        body.workflowId,
        {
          message: body.message,
          sessionId: body.sessionId,
          systemPrompt: body.systemPrompt,
          contextLength: body.contextLength || 5,
        },
        body.headers,
      );

      // Setup error handling for the response
      response.on('close', () => {
        this.logger.log('Client closed connection');
        response.end();
      });
      
      // Handle the stream
      stream.subscribe({
        next: (chunk) => {
          // Format as SSE
          response.write(`data: ${JSON.stringify(chunk)}\n\n`);
        },
        error: (err) => {
          this.logger.error(`Stream error: ${err.message}`);
          response.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
          response.end();
        },
        complete: () => {
          this.logger.log('Stream completed');
          response.write(`data: ${JSON.stringify({ done: true })}\n\n`);
          response.end();
        },
      });
    } catch (error) {
      this.logger.error(`Error in streamWebhook: ${error.message}`);
      response.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      response.end();
    }
  }
}
