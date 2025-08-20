import { Controller, Get, Post, Body, Param, Put, Delete, Logger } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { N8nIntegrationService } from './n8n-integration.service';
import { N8nOrchestratorService } from '../../core/n8n-orchestrator/n8n-orchestrator.service';
import { WebhookWorkflowTemplate } from './n8n-types';

@ApiTags('n8n')
@Controller('integrations/n8n')
export class N8nIntegrationController {
  private readonly logger = new Logger(N8nIntegrationController.name);

  constructor(
    private readonly n8nIntegrationService: N8nIntegrationService,
    private readonly n8nOrchestratorService: N8nOrchestratorService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Check n8n connection status' })
  async checkStatus() {
    const isAvailable = this.n8nOrchestratorService.isAvailable();
    return {
      status: isAvailable ? 'connected' : 'disconnected',
      message: isAvailable
        ? 'Successfully connected to n8n API'
        : 'Failed to connect to n8n API. Please check your configuration.',
    };
  }

  @Get('workflows')
  @ApiOperation({ summary: 'Get all n8n workflows' })
  async getAllWorkflows() {
    return this.n8nOrchestratorService.getAllWorkflows();
  }

  @Post('workflows')
  @ApiOperation({ summary: 'Create a new webhook workflow in n8n' })
  async createWebhookWorkflow(@Body() template: WebhookWorkflowTemplate) {
    return this.n8nIntegrationService.createWebhookWorkflow(template);
  }

  @Get('workflows/:id')
  @ApiOperation({ summary: 'Get a workflow by ID' })
  async getWorkflow(@Param('id') id: string) {
    return this.n8nOrchestratorService.getWorkflow(id);
  }

  @Delete('workflows/:id')
  @ApiOperation({ summary: 'Delete a workflow by ID' })
  async deleteWorkflow(@Param('id') id: string) {
    return this.n8nOrchestratorService.deleteWorkflow(id);
  }

  @Post('workflows/:id/activate')
  @ApiOperation({ summary: 'Activate a workflow by ID' })
  async activateWorkflow(@Param('id') id: string) {
    return this.n8nOrchestratorService.activateWorkflow(id);
  }

  @Post('workflows/:id/deactivate')
  @ApiOperation({ summary: 'Deactivate a workflow by ID' })
  async deactivateWorkflow(@Param('id') id: string) {
    return this.n8nOrchestratorService.deactivateWorkflow(id);
  }

  @Put('workflows/:id/agent-prompt')
  @ApiOperation({ summary: 'Update the AI agent prompt in a workflow' })
  async updateAgentPrompt(@Param('id') id: string, @Body() data: { prompt: string }) {
    return this.n8nIntegrationService.updateAgentPrompt(id, data.prompt);
  }
}
