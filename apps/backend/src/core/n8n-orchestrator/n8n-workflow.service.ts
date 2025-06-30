import { Injectable, Logger } from '@nestjs/common';
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
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

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
      active: false, // Workflows start as inactive by default
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
   * Create a basic agent workflow with webhook for chat processing
   * This creates a standard workflow with:
   * 1. A webhook node to receive user messages
   * 2. Dynamic parameter parsing for sessionId, systemPrompt, temperature, and chatInput
   * 3. AI processing via Google Gemini
   * 4. Response returned via the webhook
   * 
   * @param assistantId The assistant ID this workflow belongs to
   * @param organizationId The organization ID this workflow belongs to
   * @param userId The user ID this workflow belongs to (optional)
   * @param name The name of the workflow (will use a standard name if not provided)
   * @returns The created N8nWorkflow record including its ID and webhook URL
   */
  async createAgentChatWorkflow(assistantId: string, organizationId: string, userId?: string, name?: string) {
    const workflowName = name || `Agent Chat Workflow - Assistant ${assistantId}`;
    const webhookPath = `${assistantId}${userId ? '-' + userId : ''}-${Date.now()}`;
    const n8nBaseUrl = this.configService.get<string>('N8N_URL');
    
    this.logger.log(`Creating agent chat workflow: ${workflowName} with webhook path: ${webhookPath}`);
    
    const workflowData = {
      name: workflowName,
      nodes: [
        {
          parameters: {
            promptType: 'define',
            text: '={{ $json.body.chatInput }}',
            options: {
              systemMessage: '={{ $json.body.systemPrompt }}',
              maxIterations: 10
            }
          },
          type: '@n8n/n8n-nodes-langchain.agent',
          typeVersion: 2,
          position: [160, -160],
          id: '638884be-6f92-4b3e-991f-62551854d088',
          name: 'AI Agent'
        },
        {
          parameters: {
            modelName: 'models/gemini-2.5-flash',
            options: {
              maxOutputTokens: 2048,
              temperature: 0.4
            }
          },
          type: '@n8n/n8n-nodes-langchain.lmChatGoogleGemini',
          typeVersion: 1,
          position: [40, 80],
          id: '4b1ad9b1-779e-4438-86e1-d35c74dfdc0c',
          name: 'Google Gemini Chat Model',
          credentials: {
            googlePalmApi: {
              id: 'STy8vguknZjfysYZ',
              name: 'GEMINI'
            }
          }
        },
        {
          parameters: {
            path: webhookPath,
            responseMode: 'responseNode',
            options: {}
          },
          type: 'n8n-nodes-base.webhook',
          typeVersion: 2,
          position: [-120, -160],
          id: '5465a08a-6be2-47ab-a331-8a88d277fb6d',
          name: 'Webhook',
          webhookId: webhookPath
        },
        {
          parameters: {
            respondWith: 'allIncomingItems',
            options: {}
          },
          type: 'n8n-nodes-base.respondToWebhook',
          typeVersion: 1.4,
          position: [500, -160],
          id: '33979ad1-fe89-43c6-9ba6-bb6bb33ed8db',
          name: 'Respond to Webhook'
        },
        {
          parameters: {
            sessionIdType: 'customKey',
            sessionKey: '={{ $json.body.sessionId }}'
          },
          type: '@n8n/n8n-nodes-langchain.memoryBufferWindow',
          typeVersion: 1.3,
          position: [200, 60],
          id: '7f6fcc91-fc40-4b50-90c1-8e2d6c2c09ba',
          name: 'Simple Memory'
        }
      ],
      pinData: {},
      connections: {
        'Google Gemini Chat Model': {
          ai_languageModel: [
            [{
              node: 'AI Agent',
              type: 'ai_languageModel',
              index: 0
            }]
          ]
        },
        'AI Agent': {
          main: [
            [{
              node: 'Respond to Webhook',
              type: 'main',
              index: 0
            }]
          ]
        },
        'Webhook': {
          main: [
            [{
              node: 'AI Agent',
              type: 'main',
              index: 0
            }]
          ]
        },
        'Simple Memory': {
          ai_memory: [
            [{
              node: 'AI Agent',
              type: 'ai_memory',
              index: 0
            }]
          ]
        }
      },
      active: true,
      settings: {
        executionOrder: 'v1'
      }
    };
    
    // Create the workflow
    const createdWorkflow = await this.n8nClient.createWorkflow(workflowData);
    
    // Activate the workflow immediately
    await this.n8nClient.activateWorkflow(createdWorkflow.id);
    
    // Return the workflow data with the webhook URL
    const webhookUrl = `${n8nBaseUrl}/webhook/${webhookPath}`;

    // Create a record in the database using raw SQL since the Prisma client may not be fully synced with the schema
    const n8nWorkflowRecord = await this.createN8nWorkflowRecord(
      createdWorkflow.id,
      webhookUrl,
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
