import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { N8nOrchestratorService } from '../../../core/n8n-orchestrator/n8n-orchestrator.service';
import { N8nIntegrationService } from '../../../integrations/n8n/n8n-integration.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { Prisma } from '@prisma/client';
import { N8nConnectionType, N8nIntegrationNodeType, WebhookWorkflowTemplate } from '../../../integrations/n8n/n8n-types';

// Interface for n8n metadata stored in node data
interface N8nNodeMetadata {
  id?: string;
  nodeType?: string;
  position?: { x: number; y: number };
  parameters?: Record<string, any>;
  n8nNodeId?: string;
}

/**
 * Service responsible for synchronizing workflow changes between the platform database
 * and n8n. This service listens for database changes and triggers appropriate
 * n8n orchestration actions.
 */
@Injectable()
export class WorkflowSynchronizerService implements OnModuleInit {
  private readonly logger = new Logger(WorkflowSynchronizerService.name);
  private readonly n8nEnabled: boolean;
  private workflowMap: Map<string, string> = new Map(); // Maps platform workflowId to n8n workflowId

  constructor(
    private readonly prisma: PrismaService,
    private readonly n8nOrchestrator: N8nOrchestratorService,
    private readonly n8nIntegration: N8nIntegrationService,
    private readonly configService: ConfigService,
  ) {
    // Check if n8n integration is enabled
    this.n8nEnabled = this.configService.get<boolean>('N8N_ENABLED', true);
  }

  /**
   * Initialize workflow synchronization on module start
   */
  async onModuleInit() {
    if (!this.n8nEnabled) {
      this.logger.warn('n8n integration is disabled. Workflow synchronization will not be active.');
      return;
    }

    // Check if n8n is available
    if (!this.n8nOrchestrator.isAvailable()) {
      this.logger.warn('n8n is not available. Workflow synchronization will be limited.');
      return;
    }

    // Load existing workflow mapping
    await this.loadWorkflowMap();
    
    // Set up database event listeners
    this.setupEventListeners();
    
    this.logger.log('Workflow synchronizer initialized');
  }

  /**
   * Load the mapping between platform workflow IDs and n8n workflow IDs
   * Since we don't have the n8nWorkflowId field yet, we'll temporarily store
   * this mapping in memory and not persist it to the database.
   */
  private async loadWorkflowMap() {
    try {
      // In production, you would load this mapping from persistent storage
      // For now, we'll just initialize an empty map
      this.workflowMap = new Map();
      this.logger.log(`Initialized empty workflow map`);
    } catch (error) {
      this.logger.error(`Failed to load workflow map: ${error.message}`);
    }
  }

  /**
   * Set up database event listeners for workflow changes
   */
  private setupEventListeners() {
    // This is a placeholder for actual event listeners
    // In a real implementation, you might use Prisma middleware or a message queue
    // to listen for database changes
    this.logger.log('Database event listeners not implemented yet');
  }

  /**
   * Create a new workflow in n8n when a workflow is created in the platform
   * @param workflow The workflow data from the platform
   */
  async syncNewWorkflow(workflowId: string) {
    if (!this.n8nEnabled || !this.n8nOrchestrator.isAvailable()) {
      return null;
    }

    try {
      // Get the workflow from the database
      const workflow = await this.prisma.workflow.findUnique({
        where: { id: workflowId },
      });

      if (!workflow) {
        throw new Error(`Workflow with ID ${workflowId} not found`);
      }
      
      // Extract agent prompt from workflow description or use default
      // In a real implementation, you might store this in description or other field
      const agentPrompt = workflow.description || 'You are a helpful assistant.';

      // Create a webhook workflow template
      const template: WebhookWorkflowTemplate = {
        name: workflow.name,
        webhookPath: `/workflows/${workflow.id}`,
        webhookMethod: 'POST',
        memoryEnabled: true,
        agentPrompt,
      };

      // Create the workflow in n8n
      const result = await this.n8nIntegration.createWebhookWorkflow(template);

      // Store the n8n workflow ID in our in-memory map
      this.workflowMap.set(workflowId, result.workflow.id);

      this.logger.log(`Created n8n workflow for platform workflow ${workflowId}`);
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to sync new workflow ${workflowId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Update an existing workflow in n8n when a workflow is updated in the platform
   * @param workflowId The ID of the workflow to update
   */
  async syncWorkflowUpdate(workflowId: string) {
    if (!this.n8nEnabled || !this.n8nOrchestrator.isAvailable()) {
      return null;
    }

    const n8nWorkflowId = this.workflowMap.get(workflowId);
    if (!n8nWorkflowId) {
      this.logger.warn(`No n8n workflow found for platform workflow ${workflowId}`);
      return await this.syncNewWorkflow(workflowId);
    }

    try {
      // Get the workflow from the database
      const workflow = await this.prisma.workflow.findUnique({
        where: { id: workflowId },
      });

      if (!workflow) {
        throw new Error(`Workflow with ID ${workflowId} not found`);
      }

      // Extract agent prompt from workflow description or use default
      const agentPrompt = workflow.description || 'You are a helpful assistant.';

      // Update the workflow name and agent prompt
      const result = await this.n8nIntegration.updateAgentPrompt(
        n8nWorkflowId,
        agentPrompt
      );

      this.logger.log(`Updated n8n workflow for platform workflow ${workflowId}`);
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to sync workflow update ${workflowId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Delete a workflow in n8n when a workflow is deleted in the platform
   * @param workflowId The ID of the workflow to delete
   */
  async syncWorkflowDeletion(workflowId: string) {
    if (!this.n8nEnabled || !this.n8nOrchestrator.isAvailable()) {
      return false;
    }

    const n8nWorkflowId = this.workflowMap.get(workflowId);
    if (!n8nWorkflowId) {
      this.logger.warn(`No n8n workflow found for platform workflow ${workflowId}`);
      return true;
    }

    try {
      // Delete the workflow in n8n
      await this.n8nOrchestrator.deleteWorkflow(n8nWorkflowId);

      // Remove from the workflow map
      this.workflowMap.delete(workflowId);

      this.logger.log(`Deleted n8n workflow for platform workflow ${workflowId}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to sync workflow deletion ${workflowId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Add a node to an n8n workflow when a node is added in the platform
   * @param workflowId The ID of the workflow
   * @param nodeId The ID of the node
   */
  async syncNewNode(workflowId: string, nodeId: string) {
    if (!this.n8nEnabled || !this.n8nOrchestrator.isAvailable()) {
      return null;
    }

    const n8nWorkflowId = this.workflowMap.get(workflowId);
    if (!n8nWorkflowId) {
      this.logger.warn(`No n8n workflow found for platform workflow ${workflowId}`);
      return null;
    }

    try {
      // Get the workflow from the database
      const workflow = await this.prisma.workflow.findUnique({
        where: { id: workflowId },
      });
      
      if (!workflow) {
        throw new Error(`Workflow with ID ${workflowId} not found`);
      }
      
      // Extract nodes from JSON structure in the workflow
      const nodes = workflow.nodes as Prisma.JsonArray || [];
      const node = nodes.find((n: any) => n?.id === nodeId);
      
      if (!node) {
        throw new Error(`Node with ID ${nodeId} not found in workflow`);
      }
      
      // Extract tool information from node
      const nodeData = node as any;
      const toolId = nodeData.toolId;
      let toolType = 'unknown';
      
      if (toolId) {
        const tool = await this.prisma.tool.findUnique({
          where: { id: toolId },
          select: { type: true }
        });
        if (tool) {
          toolType = tool.type;
        }
      }

      // Map the platform node type to an n8n node type
      const n8nNodeType = this.mapToolTypeToN8nNodeType(toolType);
      const parameters = nodeData.parameters || {};

      // Add the node to the n8n workflow
      const result = await this.n8nIntegration.addIntegrationNode(
        n8nWorkflowId,
        n8nNodeType,
        parameters,
        {
          x: nodeData.position?.x || 300,
          y: nodeData.position?.y || 300,
        },
      );

      // Update the node in the workflow JSON structure with the n8n node ID
      const updatedNodes = (nodes as any[]).map(n => {
        if (n?.id === nodeId) {
          return {
            ...n,
            n8nNodeId: result.addedNode.id
          };
        }
        return n;
      });

      // Update the workflow with the modified nodes
      await this.prisma.workflow.update({
        where: { id: workflowId },
        data: {
          nodes: updatedNodes as any
        },
      });

      this.logger.log(`Added n8n node for platform node ${nodeId} in workflow ${workflowId}`);
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to sync new node ${nodeId} in workflow ${workflowId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Update a node in an n8n workflow when a node is updated in the platform
   * @param workflowId The ID of the workflow
   * @param nodeId The ID of the node
   */
  async syncNodeUpdate(workflowId: string, nodeId: string) {
    // Implementation would be similar to syncNewNode but with update logic
    this.logger.warn('Node update synchronization not implemented yet');
    return null;
  }

  /**
   * Delete a node from an n8n workflow when a node is deleted in the platform
   * @param workflowId The ID of the workflow
   * @param nodeId The ID of the node
   * @param n8nNodeId The ID of the node in n8n
   */
  async syncNodeDeletion(workflowId: string, nodeId: string, n8nNodeId: string) {
    // Implementation would delete the node from the n8n workflow
    this.logger.warn('Node deletion synchronization not implemented yet');
    return null;
  }

  /**
   * Add a connection between nodes in an n8n workflow when a connection is added in the platform
   * @param workflowId The ID of the workflow
   * @param connectionId The ID of the connection
   */
  async syncNewConnection(workflowId: string, connectionId: string) {
    // Implementation would add a connection between nodes in the n8n workflow
    this.logger.warn('Connection synchronization not implemented yet');
    return null;
  }

  /**
   * Map a platform tool type to an n8n node type
   * @param toolType The platform tool type
   * @returns The n8n node type
   */
  private mapToolTypeToN8nNodeType(toolType: string): N8nIntegrationNodeType {
    // Map platform tool types to n8n node types
    const toolTypeMap: Record<string, N8nIntegrationNodeType> = {
      'http-request': N8nIntegrationNodeType.HTTP_REQUEST,
      'send-sms': N8nIntegrationNodeType.SEND_SMS,
      'send-email': N8nIntegrationNodeType.SEND_EMAIL,
      // Add more mappings as needed
    };

    return toolTypeMap[toolType] || N8nIntegrationNodeType.HTTP_REQUEST;
  }
}
