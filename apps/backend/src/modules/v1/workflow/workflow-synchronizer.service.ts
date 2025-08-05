import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { N8nOrchestratorService } from '../../../core/n8n-orchestrator/n8n-orchestrator.service';
import { N8nIntegrationService } from '../../../integrations/n8n/n8n-integration.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { Prisma } from '@prisma/client';
import { N8nConnectionType, N8nIntegrationNodeType, WebhookWorkflowTemplate, N8nAiNodeType, N8nWebhookType } from '../../../integrations/n8n/n8n-types';
import { N8nTemplateService } from '../../../core/n8n-orchestrator/n8n-template.service';
import { WebhookTemplate } from '../../../core/n8n-orchestrator/templates/webhook.template';
import { AiAgentTemplate } from '../../../core/n8n-orchestrator/templates/ai-agent.template';
import { GoogleGeminiChatModelTemplate } from '../../../core/n8n-orchestrator/templates/google-gemini.template';
import { RespondToWebhookTemplate } from '../../../core/n8n-orchestrator/templates/respond-to-webhook.template';
import { v4 as uuidv4 } from 'uuid';

// Interface for n8n metadata stored in node data
interface N8nNodeMetadata {
  id?: string;
  nodeType?: string;
  position?: { x: number; y: number };
  parameters?: Record<string, any>;
  n8nNodeId?: string;
}

// Enum for custom workflow node types
enum CustomNodeType {
  START = 'start',
  AI_AGENT = 'ai_agent',
  END = 'end',
}

// Interface for custom workflow node
interface CustomWorkflowNode {
  id: string;
  type: string;
  position?: { x: number; y: number };
  data?: any;
  [key: string]: any;
}

// Interface for custom workflow edge
interface CustomWorkflowEdge {
  id: string;
  source: string;
  target: string;
  [key: string]: any;
}

// Interface for n8n workflow node
interface N8nNode {
  id: string;
  name: string;
  type: string;
  parameters: any;
  position: [number, number];
  typeVersion: number;
  credentials?: any;
  webhookId?: string;
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
    private readonly n8nTemplateService: N8nTemplateService,
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
   * This method completely rebuilds the n8n workflow based on the current state of the platform workflow
   * @param workflowId The ID of the workflow to update
   */
  async syncWorkflowUpdate(workflowId: string) {
    this.logger.debug(`[SYNC DEBUG] Starting syncWorkflowUpdate for workflow ${workflowId}`);
    this.logger.debug(`[SYNC DEBUG] n8nEnabled: ${this.n8nEnabled}, n8nOrchestrator available: ${this.n8nOrchestrator.isAvailable()}`);
    
    if (!this.n8nEnabled || !this.n8nOrchestrator.isAvailable()) {
      this.logger.warn(`[SYNC DEBUG] Skipping sync - n8n is not enabled or not available`);
      return null;
    }

    try {
      // Get the workflow from the database
      this.logger.debug(`[SYNC DEBUG] Fetching workflow ${workflowId} from database`);
      const workflow = await this.prisma.workflow.findUnique({
        where: { id: workflowId },
        include: {
          agent: true
        }
      });

      this.logger.debug(`[SYNC DEBUG] Workflow fetch result: ${workflow ? 'Found' : 'Not found'}`);
      
      if (!workflow) {
        throw new Error(`Workflow with ID ${workflowId} not found`);
      }

      // Get the n8n workflow ID
      let n8nWorkflowId = workflow.n8nWorkflowId;

      this.logger.debug(`[SYNC DEBUG] n8nWorkflowId: ${n8nWorkflowId || 'Not found'}`);
      
      if (!n8nWorkflowId) {
        this.logger.warn(`[SYNC DEBUG] No n8n workflow found for platform workflow ${workflowId}, checking for existing N8nWorkflow records`);
        
        // Check if there's any N8nWorkflow linked to this workflow's agent
        let existingN8nWorkflow = null;
        
        // Check if workflow is linked to an agent
        if (workflow.agentId) {
          this.logger.debug(`[SYNC DEBUG] Checking for existing N8nWorkflow records linked to agent ${workflow.agentId}`);
          const agentWorkflows = await this.prisma.n8nWorkflow.findMany({
            where: {
              agents: {
                some: {
                  id: workflow.agentId
                }
              }
            },
            orderBy: {
              createdAt: 'asc' // Get the oldest workflow first
            },
            take: 1
          });
          
          if (agentWorkflows.length > 0) {
            existingN8nWorkflow = agentWorkflows[0];
            this.logger.log(`[SYNC DEBUG] Found existing N8nWorkflow with ID ${existingN8nWorkflow.n8nWorkflowId} for agent ${workflow.agentId}`);
          }
        }
        
        if (existingN8nWorkflow) {
          // Update the workflow in the database with the found n8nWorkflowId
          await this.prisma.workflow.update({
            where: { id: workflowId },
            data: { n8nWorkflowId: existingN8nWorkflow.n8nWorkflowId }
          });
          
          // Use the existing n8nWorkflowId for further processing
          n8nWorkflowId = existingN8nWorkflow.n8nWorkflowId;
          
          this.logger.log(`[SYNC DEBUG] Updated workflow ${workflowId} with existing n8nWorkflowId ${n8nWorkflowId}`);
        } else {
          this.logger.warn(`[SYNC DEBUG] No existing N8nWorkflow found for workflow ${workflowId}, creating new workflow`);
          return await this.syncNewWorkflow(workflowId);
        }
      }

      // Extract agent prompt from workflow description or use default
      const agentPrompt = workflow.description || 'You are a helpful assistant.';

      // Parse the nodes and edges from the workflow JSON
      const nodes = workflow.nodes as any[] || [];
      const edges = workflow.edges as any[] || [];
      
      this.logger.debug(`[SYNC DEBUG] Nodes count: ${nodes.length}, Edges count: ${edges.length}`);
      this.logger.debug(`[SYNC DEBUG] Nodes: ${JSON.stringify(nodes)}`);
      this.logger.debug(`[SYNC DEBUG] Edges: ${JSON.stringify(edges)}`);

      try {
        // Map the custom workflow to n8n workflow
        this.logger.debug(`[SYNC DEBUG] Mapping custom workflow to n8n workflow`);
        const n8nWorkflow = await this.mapCustomWorkflowToN8n(
          workflow.id,
          workflow.name,
          nodes,
          edges,
          agentPrompt,
          n8nWorkflowId
        );

        this.logger.log(`[SYNC DEBUG] Successfully updated n8n workflow for platform workflow ${workflowId}`);
        
        return n8nWorkflow;
      } catch (error) {
        // Check if the error is a 404 (workflow not found in n8n)
        if (error.message && error.message.includes('404')) {
          this.logger.warn(`[SYNC DEBUG] n8n workflow ${n8nWorkflowId} not found in n8n (404 error). Creating a new workflow instead.`);
          
          // If the workflow exists in our database but not in n8n, we need to create a new one
          // First, update the database record to remove the invalid n8n workflow reference
          if (workflow.n8nWorkflowId) {
            this.logger.debug(`[SYNC DEBUG] Removing invalid n8n workflow reference from platform workflow ${workflowId}`);
            await this.prisma.workflow.update({
              where: { id: workflowId },
              data: { n8nWorkflowId: null }
            });
            
            // Also fetch and delete the associated N8nWorkflow record if it exists
            const n8nWorkflowRecord = await this.prisma.n8nWorkflow.findUnique({
              where: { id: workflow.n8nWorkflowId }
            });
            
            if (n8nWorkflowRecord) {
              this.logger.debug(`[SYNC DEBUG] Deleting invalid N8nWorkflow record ${n8nWorkflowRecord.id}`);
              await this.prisma.n8nWorkflow.delete({
                where: { id: n8nWorkflowRecord.id }
              });
            }
          }
          
          // Create a new workflow
          return await this.syncNewWorkflow(workflowId);
        }
        
        // If it's not a 404 error, rethrow it
        throw error;
      }
    } catch (error) {
      this.logger.error(`[SYNC DEBUG] Failed to sync workflow update ${workflowId}: ${error.message}`);
      this.logger.error(`[SYNC DEBUG] Error stack: ${error.stack}`);
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

  /**
   * Map a custom node type to an n8n node type
   * @param nodeType The custom node type
   * @returns The n8n node type
   */
  private mapCustomNodeTypeToN8nNodeType(nodeType: string): string {
    // Map custom node types to n8n node types
    const nodeTypeMap: Record<string, string> = {
      [CustomNodeType.START]: 'n8n-nodes-base.webhook',
      [CustomNodeType.AI_AGENT]: '@n8n/n8n-nodes-langchain.agent',
      [CustomNodeType.END]: 'n8n-nodes-base.respondToWebhook',
    };

    return nodeTypeMap[nodeType] || 'n8n-nodes-base.function';
  }

  /**
   * Map a custom workflow to an n8n workflow
   * @param workflowId The ID of the workflow
   * @param workflowName The name of the workflow
   * @param customNodes The custom nodes from the platform
   * @param customEdges The custom edges from the platform
   * @param agentPrompt The agent prompt to use
   * @param n8nWorkflowId The ID of the existing n8n workflow to update
   * @returns The updated n8n workflow
   */
  async mapCustomWorkflowToN8n(
    workflowId: string,
    workflowName: string,
    customNodes: CustomWorkflowNode[],
    customEdges: CustomWorkflowEdge[],
    agentPrompt: string,
    n8nWorkflowId: string
  ) {
    this.logger.log(`Mapping custom workflow ${workflowId} to n8n workflow ${n8nWorkflowId}`);
    
    try {
      // Get the existing n8n workflow
      const existingWorkflow = await this.n8nOrchestrator.getWorkflow(n8nWorkflowId);
      
      // Generate a webhook ID for the workflow
      const webhookId = uuidv4();
      
      // Create the n8n nodes array
      const n8nNodes: N8nNode[] = [];
      
      // Create a map to track the mapping between custom node IDs and n8n node IDs
      const nodeIdMap = new Map<string, string>();
      
      // Process each node in the custom workflow
      this.logger.debug(`[SYNC DEBUG] Processing ${customNodes.length} custom nodes`);
      
      for (const customNode of customNodes) {
        this.logger.debug(`[SYNC DEBUG] Processing node ${customNode.id} of type ${customNode.type}`);
        const n8nNodeId = uuidv4();
        nodeIdMap.set(customNode.id, n8nNodeId);
        
        // Map node based on its type
        if (customNode.type === 'START') {
          // Create webhook node for START type
          const webhookNode = this.n8nTemplateService.parseTemplate(WebhookTemplate, {
            WEBHOOK_PATH: `workflows/${workflowId}`,
            WEBHOOK_ID: webhookId
          });
          
          n8nNodes.push({
            id: n8nNodeId,
            name: 'Webhook',
            type: 'n8n-nodes-base.webhook',
            parameters: webhookNode.parameters,
            position: [customNode.position?.x || 100, customNode.position?.y || 100],
            typeVersion: 1.1,
            webhookId: webhookId
          });
        } 
        else if (customNode.type === 'END') {
          // Create respond to webhook node for END type
          const respondNode = this.n8nTemplateService.parseTemplate(RespondToWebhookTemplate, {});
          
          n8nNodes.push({
            id: n8nNodeId,
            name: 'Respond to Webhook',
            type: 'n8n-nodes-base.respondToWebhook',
            parameters: respondNode.parameters,
            position: [customNode.position?.x || 900, customNode.position?.y || 100],
            typeVersion: 1
          });
        }
        else if (customNode.type === 'AI_AGENT' || customNode.id.includes('assistant')) {
          // For AI_AGENT type or any node with 'assistant' in its ID
          
          // First create the AI agent node
          const aiAgentNodeTemplate = this.n8nTemplateService.parseTemplate(AiAgentTemplate, {
            MESSAGE: '={{ $json.body.message }}',
            SYSTEM_PROMPT: agentPrompt
          });
          
          n8nNodes.push({
            id: n8nNodeId,
            name: 'AI Agent',
            type: '@n8n/n8n-nodes-langchain.agent',
            parameters: aiAgentNodeTemplate.parameters,
            position: [customNode.position?.x || 500, customNode.position?.y || 100],
            typeVersion: 2
          });
          
          // Then create a Gemini node that will connect to this AI agent
          const geminiNodeId = uuidv4();
          
          // Parse the Google Gemini template
          const geminiNode = this.n8nTemplateService.parseTemplate(GoogleGeminiChatModelTemplate, {
            MODEL_NAME: 'models/gemini-2.5-flash',
            CREDENTIAL_ID: 'STy8vguknZjfysYZ',
            CREDENTIAL_NAME: 'GEMINI'
          });
          
          // Add the Google Gemini node to the n8n nodes array
          n8nNodes.push({
            id: geminiNodeId,
            name: 'Google Gemini Chat Model',
            type: '@n8n/n8n-nodes-langchain.lmChatGoogleGemini',
            parameters: geminiNode.parameters,
            position: [customNode.position?.x || 300, (customNode.position?.y || 100) + 200],
            typeVersion: 1,
            credentials: geminiNode.credentials
          });
          
          // Store this connection for later
          // We'll add it to the main connections object after processing all nodes
          const geminiConnection = {
            sourceId: geminiNodeId,
            targetId: n8nNodeId,
            type: N8nConnectionType.AI_LANGUAGE_MODEL
          };
          
          // We'll process this connection after all nodes are created
        }
        else {
          // For any other node type (like 'yello'), create a Function node
          // This is a placeholder - you can enhance this to map to more specific n8n node types
          this.logger.debug(`[SYNC DEBUG] Creating function node for custom node type: ${customNode.type}`);
          
          // Get the node data or label
          const nodeLabel = customNode.data?.label || 'Custom Node';
          const nodeContent = customNode.data?.content || '';
          
          // Create a Function node that returns the content
          n8nNodes.push({
            id: n8nNodeId,
            name: nodeLabel,
            type: 'n8n-nodes-base.function',
            parameters: {
              functionCode: `// This represents a custom node of type: ${customNode.type}\n` +
                          `// Original content: ${nodeContent}\n\n` +
                          `return items;`
            },
            position: [customNode.position?.x || 500, customNode.position?.y || 300],
            typeVersion: 1
          });
        }
      }
      
      // Create the connections between nodes based on custom edges
      const connections: Record<string, any> = {};
      
      this.logger.debug(`[SYNC DEBUG] Processing ${customEdges.length} custom edges`);
      
      // Process all regular edges from the custom workflow
      for (const edge of customEdges) {
        const sourceNodeId = nodeIdMap.get(edge.source);
        const targetNodeId = nodeIdMap.get(edge.target);
        
        if (sourceNodeId && targetNodeId) {
          this.logger.debug(`[SYNC DEBUG] Creating connection from ${edge.source} to ${edge.target}`);
          
          // Initialize the connection object for this source node if it doesn't exist
          if (!connections[sourceNodeId]) {
            connections[sourceNodeId] = {
              main: [[]]
            };
          }
          
          // Add the connection to the target node
          connections[sourceNodeId].main[0].push({
            node: targetNodeId,
            type: 'main',
            index: 0
          });
        }
      }
      
      // Process all Gemini to AI Agent connections
      // Find all AI agent nodes and their corresponding Gemini nodes
      for (let i = 0; i < n8nNodes.length; i++) {
        const node = n8nNodes[i];
        
        // If this is a Gemini node, find the AI agent it should connect to
        if (node.type === '@n8n/n8n-nodes-langchain.lmChatGoogleGemini') {
          // Find the closest AI agent node (should be the one created alongside this Gemini node)
          const aiAgentNode = n8nNodes.find(n => 
            n.type === '@n8n/n8n-nodes-langchain.agent' && 
            Math.abs(n.position[0] - node.position[0]) < 300 && 
            Math.abs(n.position[1] - node.position[1]) < 300
          );
          
          if (aiAgentNode) {
            this.logger.debug(`[SYNC DEBUG] Creating AI model connection from Gemini to AI Agent`);
            
            // Initialize the connection object for this Gemini node
            if (!connections[node.id]) {
              connections[node.id] = {};
            }
            
            // Add the AI language model connection
            connections[node.id][N8nConnectionType.AI_LANGUAGE_MODEL] = [
              [
                {
                  node: aiAgentNode.id,
                  type: N8nConnectionType.AI_LANGUAGE_MODEL,
                  index: 0
                }
              ]
            ];
          }
        }
      }
      
      // Create the updated workflow data
      const updatedWorkflowData = {
        name: workflowName,
        nodes: n8nNodes,
        connections: connections,
        settings: {
          executionOrder: 'v1',
          saveManualExecutions: true,
          callerPolicy: 'workflowsFromSameOwner',
          errorWorkflow: '',
          timezone: 'America/New_York'
        }
      };
      
      // Update the workflow in n8n
      const updatedWorkflow = await this.n8nOrchestrator.updateWorkflow(
        n8nWorkflowId,
        updatedWorkflowData
      );
      
      // Update the N8nWorkflow record in the database
      await this.prisma.n8nWorkflow.update({
        where: { n8nWorkflowId: n8nWorkflowId },
        data: {
          workflowJson: JSON.parse(JSON.stringify(updatedWorkflowData)) as Prisma.JsonValue
        }
      });
      
      this.logger.log(`Successfully mapped custom workflow ${workflowId} to n8n workflow ${n8nWorkflowId}`);
      
      return updatedWorkflow;
    } catch (error) {
      this.logger.error(`Failed to map custom workflow ${workflowId} to n8n workflow: ${error.message}`);
      throw error;
    }
  }
}
