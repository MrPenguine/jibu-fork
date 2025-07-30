import { Injectable, Logger, HttpException } from '@nestjs/common';
import { N8nTemplateService } from './n8n-template.service';
import { GoogleGeminiChatModelTemplate } from './templates/google-gemini.template';
import { AiAgentTemplate } from './templates/ai-agent.template';
import { WebhookTemplate } from './templates/webhook.template';
import { RespondToWebhookTemplate } from './templates/respond-to-webhook.template';
import { N8nClient } from './n8n-client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../core/database/prisma.service';

/**
 * Service for managing n8n workflows
 * This service handles the creation, updating, and management of entire workflows in n8n
 */
@Injectable()
export class N8nWorkflowService {
  private readonly logger = new Logger(N8nWorkflowService.name);

  constructor(
    private readonly n8nClient: N8nClient,
    private readonly n8nTemplateService: N8nTemplateService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  /**
   * Generate a unique ID for N8N nodes and webhooks
   */
  private generateUniqueId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Create a new workflow in n8n
   * @param name The name of the workflow
   * @param description Optional description of the workflow
   * @returns The created workflow data
   */
  async createWorkflow(name: string, description?: string) {
    this.logger.log(`Creating workflow: ${name}`);
    
    const workflowData = {
      name,
      nodes: [],
      connections: { main: [] },
      settings: {
        executionOrder: 'v1',
      },
      tags: [],
    };

    if (description) {
      workflowData['description'] = description;
    }

    return await this.n8nClient.createWorkflow(workflowData);
  }

  /**
   * Get a workflow by ID
   * @param workflowId The ID of the workflow to get
   * @returns The workflow data
   */
  async getWorkflow(workflowId: string) {
    return await this.n8nClient.getWorkflow(workflowId);
  }

  /**
   * Update a workflow by ID
   * @param workflowId The ID of the workflow to update
   * @param updates The updates to apply to the workflow
   * @returns The updated workflow data
   */
  async updateWorkflow(workflowId: string, updates: any) {
    this.logger.log(`Updating workflow: ${workflowId}`);
    
    // First get the current workflow to ensure we don't overwrite any data
    const currentWorkflow = await this.n8nClient.getWorkflow(workflowId);
    
    // Apply the updates to the current workflow data
    const updatedWorkflow = {
      ...currentWorkflow,
      ...updates,
    };
    
    return await this.n8nClient.updateWorkflow(workflowId, updatedWorkflow);
  }

  /**
   * Delete a workflow by ID
   * @param workflowId The ID of the workflow to delete
   * @returns True if deletion was successful
   */
  async deleteWorkflow(workflowId: string) {
    this.logger.log(`Deleting workflow: ${workflowId}`);
    return await this.n8nClient.deleteWorkflow(workflowId);
  }

  /**
   * Activate a workflow by ID
   * @param workflowId The ID of the workflow to activate
   * @returns The activated workflow data
   */
  async activateWorkflow(workflowId: string) {
    this.logger.log(`Activating workflow: ${workflowId}`);
    return await this.n8nClient.activateWorkflow(workflowId);
  }

  /**
   * Deactivate a workflow by ID
   * @param workflowId The ID of the workflow to deactivate
   * @returns The deactivated workflow data
   */
  async deactivateWorkflow(workflowId: string) {
    this.logger.log(`Deactivating workflow: ${workflowId}`);
    return await this.n8nClient.deactivateWorkflow(workflowId);
  }

  /**
   * Export a workflow as JSON
   * @param workflowId The ID of the workflow to export
   * @returns The workflow JSON data
   */
  async exportWorkflow(workflowId: string) {
    const workflow = await this.n8nClient.getWorkflow(workflowId);
    return workflow;
  }

  /**
   * Import a workflow from JSON
   * @param workflowData The workflow data to import
   * @returns The imported workflow data
   */
  async importWorkflow(workflowData: any) {
    this.logger.log(`Importing workflow: ${workflowData.name || 'Unnamed workflow'}`);
    return await this.n8nClient.createWorkflow(workflowData);
  }

  /**
   * Create a basic agent workflow with chat trigger for chat processing
   * This creates a standard workflow with:
   * 1. A chat trigger node to receive user messages
   * 2. Dynamic parameter parsing for sessionId, systemPrompt, and message
   * 3. AI processing via Google Gemini
   * 4. Simple memory for conversation context
   * 
   * @param assistantId The assistant ID this workflow belongs to
   * @param organizationId The organization ID this workflow belongs to
   * @param userId The user ID this workflow belongs to (optional)
   * @param name The name of the workflow (will use a standard name if not provided)
   * @returns The created N8nWorkflow record including its ID
   */
  async createAgentChatWorkflow(assistantId: string, organizationId: string, userId?: string, name?: string) {
    const workflowName = name || `Agent Chat Workflow - Assistant ${assistantId}`;
    const webhookId = crypto.randomUUID();
    
    this.logger.log(`Creating agent chat workflow: ${workflowName} with chat trigger node`);
    
        const geminiNode = this.n8nTemplateService.parseTemplate(GoogleGeminiChatModelTemplate, {
      MODEL_NAME: 'models/gemini-1.5-flash',
      CREDENTIAL_ID: 'STy8vguknZjfysYZ', // This should ideally come from a config service
      CREDENTIAL_NAME: 'GEMINI',
    });

    const agentNode = this.n8nTemplateService.parseTemplate(AiAgentTemplate, {
      MESSAGE: '={{ $json.body.message }}',
      SYSTEM_PROMPT: '={{ $json.body.systemPrompt || "You are a helpful AI assistant. Respond to user queries in a friendly and informative manner." }}',
    });

    const webhookNode = this.n8nTemplateService.parseTemplate(WebhookTemplate, {
      WEBHOOK_PATH: `{{$json.body.assistantId}}`,
      WEBHOOK_ID: webhookId,
    });

    const respondNode = this.n8nTemplateService.parseTemplate(RespondToWebhookTemplate, {});

    // Assign static IDs to nodes for predictable connections
    const webhookNodeId = crypto.randomUUID();
    const agentNodeId = crypto.randomUUID();
    const geminiNodeId = crypto.randomUUID();
    const respondNodeId = crypto.randomUUID();

    const workflowData = {
      name: workflowName,
      nodes: [
        { ...geminiNode, id: geminiNodeId, position: [260, 240] },
        { ...agentNode, id: agentNodeId, position: [500, 0] },
        { ...webhookNode, id: webhookNodeId, position: [260, 0] },
        { ...respondNode, id: respondNodeId, position: [740, 0] },
      ],
      pinData: {},
      connections: {
        'Webhook': {
          main: [
            [{ node: 'AI Agent', type: 'main', index: 0 }]
          ]
        },
        'AI Agent': {
          main: [
            [{ node: 'Respond to Webhook', type: 'main', index: 0 }]
          ]
        },
        'Google Gemini Chat Model': {
          ai_languageModel: [
            [{ node: 'AI Agent', type: 'ai_languageModel', index: 0 }]
          ]
        },
      },
      settings: {
        executionOrder: 'v1'
      }
    };
    
    // Create the workflow
    const createdWorkflow = await this.n8nClient.createWorkflow(workflowData);
    
    // Activate the workflow immediately
    await this.n8nClient.activateWorkflow(createdWorkflow.id);
    
    // For Chat Trigger nodes, we store the webhook ID for reference
    const triggerReference = webhookId;

    // Create a record in the database using raw SQL since the Prisma client may not be fully synced with the schema
    const n8nWorkflowRecord = await this.createN8nWorkflowRecord(
      createdWorkflow.id,
      triggerReference, // Store the trigger reference instead of webhook URL
      workflowData,
      organizationId,
      assistantId,
    );

    return n8nWorkflowRecord;
  }

  /**
   * Creates an N8nWorkflow record in the database to track the workflow ID and webhook URL
   * @param n8nWorkflowId The ID of the workflow in n8n
   * @param webhookUrl Optional webhook URL for the workflow
   * @param workflowJson Optional serialized workflow JSON
   * @param organizationId The organization ID this workflow belongs to
   * @param assistantId Optional assistant ID to link this workflow to
   * @param agentId Optional agent ID to link this workflow to
   * @returns The created N8nWorkflow record
   */
  async createN8nWorkflowRecord(
    n8nWorkflowId: string,
    webhookUrl: string | null,
    workflowJson: object | null,
    organizationId: string,
    assistantId?: string,
    agentId?: string,
  ) {
    this.logger.log(`Creating N8nWorkflow record for workflow ${n8nWorkflowId}`);
    
    // Define the type for the N8nWorkflow record
    interface N8nWorkflowRecord {
      id: string;
      n8nWorkflowId: string;
      webhookUrl: string | null;
      workflowJson: object | null;
      isActive: boolean;
      lastValidatedAt: Date;
      organizationId: string;
    }
    
    // Create the N8nWorkflow record
    const n8nWorkflowRecord = await this.prisma.n8nWorkflow.create({
      data: {
        n8nWorkflowId,
        webhookUrl,
        workflowJson,
        isActive: true,
        lastValidatedAt: new Date(),
        organization: { connect: { id: organizationId } },
        ...(assistantId && { assistants: { connect: { id: assistantId } } }),
        ...(agentId && { agents: { connect: { id: agentId } } }),
      },
    }) as N8nWorkflowRecord; // Type cast to our interface
    
    // If we have an assistantId, update the assistant to link to this workflow
    if (assistantId) {
      // Use raw SQL to update the assistant with the new workflow ID since Prisma types may not be updated
      await this.prisma.$executeRaw`
        UPDATE "Assistant" 
        SET "n8nWorkflowId" = ${n8nWorkflowRecord.id} 
        WHERE "id" = ${assistantId}
      `;
    }
    
    return n8nWorkflowRecord;
  }

  /**
   * Get an existing N8nWorkflow or create a new one for an assistant
   * @param assistantId The assistant ID 
   * @param organizationId The organization ID
   * @returns The N8nWorkflow record
   */
  async getOrCreateAssistantWorkflow(assistantId: string, organizationId: string) {
    // First check if the assistant already has a workflow
    const assistant = await this.prisma.assistant.findUnique({
      where: { id: assistantId },
    });

    // Use raw query to check for n8nWorkflowId as it might not be in the Prisma types yet
    const assistantWithN8nId = await this.prisma.$queryRaw`
      SELECT "n8nWorkflowId" FROM "Assistant" WHERE "id" = ${assistantId}
    `;
    
    const n8nWorkflowId = Array.isArray(assistantWithN8nId) && assistantWithN8nId.length > 0 ? 
      assistantWithN8nId[0].n8nWorkflowId : null;
      
    if (n8nWorkflowId) {
      // Get the linked workflow
      const workflow = await this.prisma.$queryRaw`
        SELECT * FROM "N8nWorkflow" WHERE "id" = ${n8nWorkflowId}
      `;
      
      if (workflow && Array.isArray(workflow) && workflow.length > 0) {
        return workflow[0];
      }
    }

    // If no workflow exists, create a new one
    return this.createAgentChatWorkflow(assistantId, organizationId);
  }

  async createEmptyWorkflow(workflowName: string, organizationId: string) {
    this.logger.log(`Creating empty workflow: ${workflowName}`);
    
    // First, test N8N connectivity
    try {
      this.logger.log('Testing N8N connectivity before creating workflow...');
      const isHealthy = await this.n8nClient.ping();
      if (!isHealthy) {
        this.logger.error('N8N health check failed - server may not be running');
        throw new HttpException('N8N server is not accessible', 503);
      }
      this.logger.log('N8N connectivity test passed');
    } catch (healthError) {
      this.logger.error(`N8N health check error: ${healthError.message}`);
      throw new HttpException('N8N server connectivity failed', 503);
    }
    
    // Create a minimal workflow with just a Manual Trigger node
    // This is the simplest possible workflow that n8n will accept
    const nodeId = this.generateUniqueId();
    
    const workflowData = {
      name: workflowName,
      nodes: [
        {
          id: nodeId,
          name: 'Manual Trigger',
          type: 'n8n-nodes-base.manualTrigger',
          typeVersion: 1,
          position: [240, 300],
          parameters: {}
        }
      ],
      connections: {},
      settings: {
        executionOrder: 'v1'
      }
    };

    try {
      const newWorkflow = await this.n8nClient.createWorkflow(workflowData);
      this.logger.log(`Successfully created empty N8N workflow with ID: ${newWorkflow.id}`);
      
      // Create the corresponding database record in N8nWorkflow table
      const n8nWorkflowRecord = await this.prisma.n8nWorkflow.create({
        data: {
          n8nWorkflowId: newWorkflow.id,
          workflowJson: workflowData,
          isActive: false, // Will be activated separately if needed
          organizationId: organizationId
        }
      });
      
      this.logger.log(`Created N8nWorkflow database record with ID: ${n8nWorkflowRecord.id}`);
      
      // Return the database record (which includes the n8n workflow ID)
      return n8nWorkflowRecord;
    } catch (error) {
      this.logger.error(`Failed to create empty N8N workflow: ${workflowName}`, error.stack);
      throw new HttpException('Failed to create empty N8N workflow', 500);
    }
  }

  /**
   * Validate that a workflow exists in n8n and is active
   * @param workflowRecord The N8nWorkflow record to validate
   * @returns True if the workflow is valid, false otherwise
   */
  async validateWorkflow(workflowRecord: any): Promise<boolean> {
    try {
      // Try to get the workflow from n8n
      const workflow = await this.n8nClient.getWorkflow(workflowRecord.n8nWorkflowId);
      
      // Update the validation timestamp using raw SQL
      await this.prisma.$executeRaw`
        UPDATE "N8nWorkflow" 
        SET "lastValidatedAt" = ${new Date()}
        WHERE "id" = ${workflowRecord.id}
      `;

      // Check if the workflow is active
      return workflow.active === true;
    } catch (error) {
      this.logger.error(`Failed to validate workflow ${workflowRecord.id}: ${error.message}`);
      return false;
    }
  }

  /**
   * Create or update a N8nWorkflow and ensure it's active
   * @param workflowId Optional existing N8nWorkflow ID
   * @param assistantId The associated assistant ID
   * @param organizationId The organization ID
   * @returns The active N8nWorkflow record
   */
  async ensureActiveWorkflow(
    workflowId?: string, 
    assistantId?: string, 
    organizationId?: string
  ): Promise<any> {
    // If we have a workflowId, try to get the existing record using raw SQL
    if (workflowId) {
      const workflows = await this.prisma.$queryRaw`
        SELECT * FROM "N8nWorkflow" WHERE "id" = ${workflowId}
      `;
      
      const workflow = Array.isArray(workflows) && workflows.length > 0 ? workflows[0] : null;

      if (workflow) {
        // Validate that the workflow is active in n8n
        const isValid = await this.validateWorkflow(workflow);

        if (isValid) {
          return workflow;
        } else {
          // Try to reactivate the workflow
          try {
            await this.n8nClient.activateWorkflow(workflow.n8nWorkflowId);
            await this.prisma.$executeRaw`
              UPDATE "N8nWorkflow" 
              SET "isActive" = true, "lastValidatedAt" = ${new Date()}
              WHERE "id" = ${workflow.id}
            `;
            return workflow;
          } catch (error) {
            this.logger.error(`Failed to reactivate workflow ${workflow.id}: ${error.message}`);
            // Will fall through to create a new workflow
          }
        }
      }
    }

    // If we have an assistantId and organizationId, create a new workflow
    if (assistantId && organizationId) {
      return this.getOrCreateAssistantWorkflow(assistantId, organizationId);
    }

    throw new Error('Cannot ensure active workflow without either an existing workflowId or assistantId+organizationId');
  }
}
