import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { N8nClient } from '../../core/n8n-orchestrator/n8n-client';
import { 
  N8nAiNodeType, 
  N8nConnectionType, 
  N8nIntegrationNodeType, 
  N8nNode, 
  N8nWebhookType, 
  NodePosition, 
  WebhookWorkflowTemplate 
} from './n8n-types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Service for integrating with n8n
 * This service provides high-level operations for interacting with n8n,
 * particularly focused on creating and managing AI agent workflows
 */
@Injectable()
export class N8nIntegrationService {
  private readonly logger = new Logger(N8nIntegrationService.name);
  private readonly webhookBaseUrl: string;

  constructor(
    private readonly n8nClient: N8nClient,
    private readonly configService: ConfigService,
  ) {
    this.webhookBaseUrl = this.configService.get<string>('N8N_WEBHOOK_BASE_URL');
    
    if (!this.webhookBaseUrl) {
      this.logger.warn('N8N_WEBHOOK_BASE_URL not set in environment. Webhook URLs may not be accessible externally.');
    }
  }

  /**
   * Create a new webhook-based workflow in n8n
   * This creates a workflow that starts with a webhook trigger, processes through an AI agent,
   * and ends with a webhook response
   * 
   * @param template Template for the webhook workflow
   * @returns The created workflow
   */
  async createWebhookWorkflow(template: WebhookWorkflowTemplate) {
    try {
      // Generate a webhook ID
      const webhookId = uuidv4();
      
      // Create positions for the standard nodes
      const webhookPosition: [number, number] = [-120, -160];
      const agentPosition: [number, number] = [100, -160];
      const responsePosition: [number, number] = [500, -160];
      const modelPosition: [number, number] = [40, 80];
      const memoryPosition: [number, number] = [180, 80];
      
      // Create the basic nodes for the workflow
      const nodes: N8nNode[] = [];
      
      // Create webhook node
      const webhookNode: N8nNode = {
        id: uuidv4(),
        name: 'Webhook',
        type: N8nWebhookType.STANDARD,
        parameters: {
          path: webhookId,
          responseMode: 'responseNode',
          httpMethod: template.webhookMethod || 'POST',
          options: {},
          // Store the webhookId in parameters instead of at the root level
          webhookId: webhookId,
        },
        position: webhookPosition,
        typeVersion: 2,
      };
      nodes.push(webhookNode);
      
      // Create AI model node (using Gemini as default)
      const modelNode: N8nNode = {
        id: uuidv4(),
        name: 'Google Gemini Chat Model',
        type: N8nAiNodeType.GEMINI_CHAT,
        parameters: {
          modelName: 'models/gemini-2.5-flash',
          options: {},
        },
        position: modelPosition,
        typeVersion: 1,
        credentials: {
          googlePalmApi: {
            id: 'STy8vguknZjfysYZ',
            name: 'GEMINI'
          }
        },
      };
      nodes.push(modelNode);
      
      // Create AI agent node
      const agentNode: N8nNode = {
        id: uuidv4(),
        name: 'AI Agent',
        type: N8nAiNodeType.LANGCHAIN_AGENT,
        parameters: {
          promptType: 'define',
          // Use message field from webhook body for the prompt
          text: '={{ $json.body.message }}',
          options: {
            // Configure system message to use template value if provided, otherwise use from webhook body, with fallback
            systemMessage: '={{ $json.body.systemPrompt || "' + (template.agentPrompt || 'You are an AI assistant.') + '" }}',
          },
        },
        position: agentPosition,
        typeVersion: 2,
      };
      nodes.push(agentNode);
      
      // Create webhook response node
      const responseNode: N8nNode = {
        id: uuidv4(),
        name: 'Respond to Webhook',
        type: N8nWebhookType.RESPONSE,
        parameters: {
          respondWith: 'allIncomingItems',
          options: {},
        },
        position: responsePosition,
        typeVersion: 1.4,
      };
      nodes.push(responseNode);
      
      // Optionally add memory node if enabled
      if (template.memoryEnabled) {
        const memoryNode: N8nNode = {
          id: uuidv4(),
          name: 'Simple Memory',
          type: N8nAiNodeType.MEMORY_BUFFER,
          parameters: {
            sessionIdType: 'customKey',
            sessionKey: '={{ $("Webhook").item.json.body.sessionId }}',
            // Use an expression to get contextLength from the webhook body, with fallback to template value or default
            contextWindowLength: '={{ $("Webhook").item.json.body.contextLength || ' + (template.contextWindowLength || 5) + ' }}',
          },
          position: memoryPosition,
          typeVersion: 1.3,
        };
        nodes.push(memoryNode);
      }
      
      // Add any additional integration nodes
      if (template.integrationNodes && template.integrationNodes.length > 0) {
        template.integrationNodes.forEach((integrationNode, index) => {
          const node: N8nNode = {
            id: uuidv4(),
            name: `Integration Node ${index + 1}`,
            type: integrationNode.type,
            parameters: integrationNode.parameters,
            position: [integrationNode.position.x, integrationNode.position.y],
            typeVersion: 1,
          };
          nodes.push(node);
        });
      }
      
      // Create the connections between nodes
      const connections: Record<string, Record<string, Array<Array<{node: string; type: string; index: number}>>>> = {};
      
      // Webhook node connections
      connections[webhookNode.name] = {
        main: [
          [
            {
              node: agentNode.name,
              type: 'main',
              index: 0
            }
          ]
        ]
      };
      
      // Agent node connections
      connections[agentNode.name] = {
        main: [
          [
            {
              node: responseNode.name,
              type: 'main',
              index: 0
            }
          ]
        ]
      };
      
      // Model node connections
      connections[modelNode.name] = {
        [N8nConnectionType.AI_LANGUAGE_MODEL]: [
          [
            {
              node: agentNode.name,
              type: N8nConnectionType.AI_LANGUAGE_MODEL,
              index: 0
            }
          ]
        ]
      };
      
      // Add memory connection to agent if enabled
      if (template.memoryEnabled) {
        const memoryNode = nodes.find(node => node.type === N8nAiNodeType.MEMORY_BUFFER);
        if (memoryNode) {
          connections[memoryNode.name] = {
            'ai_memory': [
              [
                {
                  node: agentNode.name,
                  type: 'ai_memory',
                  index: 0
                }
              ]
            ]
          };
        }
      }
      
      // Create the workflow
      const workflowData = {
        name: template.name || `Webhook Workflow ${new Date().toISOString().split('T')[0]}`,
        nodes,
        connections,
        settings: {
          executionOrder: 'v1',
        },
      };
      
      const workflow = await this.n8nClient.createWorkflow(workflowData);
      
      // Activate the workflow
      await this.n8nClient.activateWorkflow(workflow.id);
      
      // Construct the webhook URL
      let webhookUrl = '';
      if (this.webhookBaseUrl) {
        webhookUrl = `${this.webhookBaseUrl}/webhook/${webhookId}`;
      } else {
        webhookUrl = `${this.configService.get<string>('N8N_URL')}/webhook/${webhookId}`;
      }
      
      return {
        workflow,
        webhookUrl,
        webhookId,
      };
      
    } catch (error) {
      this.logger.error(`Error creating webhook workflow: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get a webhook URL for a workflow
   * @param webhookId The webhook ID
   * @returns The webhook URL
   */
  async updateWebhookWorkflow(workflowId: string, template: WebhookWorkflowTemplate) {
    try {
      this.logger.log(`Updating webhook workflow ${workflowId}`);

      // Fetch the existing workflow to preserve webhook IDs
      const existingWorkflow = await this.n8nClient.getWorkflow(workflowId);
      this.logger.debug(`Retrieved existing workflow: ${JSON.stringify(existingWorkflow)}`);
      
      // Find the existing webhook node to preserve its ID
      const existingWebhookNode = existingWorkflow.nodes.find(node => node.type === N8nWebhookType.STANDARD);
      
      // Use existing webhook ID if available, otherwise generate a new one
      let webhookId;
      if (existingWebhookNode && existingWebhookNode.parameters && existingWebhookNode.parameters.webhookId) {
        webhookId = existingWebhookNode.parameters.webhookId;
        this.logger.log(`Preserving existing webhook ID: ${webhookId}`);
      } else {
        webhookId = uuidv4();
        this.logger.log(`No existing webhook ID found, generating new one: ${webhookId}`);
      }

      const webhookPosition: [number, number] = [-120, -160];
      const agentPosition: [number, number] = [100, -160];
      const responsePosition: [number, number] = [500, -160];
      const modelPosition: [number, number] = [40, 80];
      const memoryPosition: [number, number] = [180, 80];

      const nodes: N8nNode[] = [];

      const webhookNode: N8nNode = {
        id: uuidv4(),
        name: 'Webhook',
        type: N8nWebhookType.STANDARD,
        parameters: {
          path: webhookId,
          responseMode: 'responseNode',
          httpMethod: template.webhookMethod || 'POST',
          options: {},
          webhookId: webhookId,
        },
        position: webhookPosition,
        typeVersion: 2,
      };
      nodes.push(webhookNode);

      const modelNode: N8nNode = {
        id: uuidv4(),
        name: 'Google Gemini Chat Model',
        type: N8nAiNodeType.GEMINI_CHAT,
        parameters: {
          modelName: 'models/gemini-1.5-flash',
          options: {},
        },
        position: modelPosition,
        typeVersion: 1,
        credentials: {
          googlePalmApi: {
            id: 'STy8vguknZjfysYZ',
            name: 'GEMINI'
          }
        },
      };
      nodes.push(modelNode);

      const agentNode: N8nNode = {
        id: uuidv4(),
        name: 'AI Agent',
        type: N8nAiNodeType.LANGCHAIN_AGENT,
        parameters: {
          promptType: 'define',
          text: '={{ $json.body.message }}',
          options: {
            systemMessage: '={{ $json.body.systemPrompt || "' + (template.agentPrompt || 'You are an AI assistant.') + '" }}',
          },
        },
        position: agentPosition,
        typeVersion: 2,
      };
      nodes.push(agentNode);

      const responseNode: N8nNode = {
        id: uuidv4(),
        name: 'Respond to Webhook',
        type: N8nWebhookType.RESPONSE,
        parameters: {
          respondWith: 'allIncomingItems',
          options: {},
        },
        position: responsePosition,
        typeVersion: 1.4,
      };
      nodes.push(responseNode);

      if (template.memoryEnabled) {
        const memoryNode: N8nNode = {
          id: uuidv4(),
          name: 'Simple Memory',
          type: N8nAiNodeType.MEMORY_BUFFER,
          parameters: {
            sessionIdType: 'customKey',
            sessionKey: '={{ $("Webhook").item.json.body.sessionId }}',
            contextWindowLength: '={{ $("Webhook").item.json.body.contextLength || ' + (template.contextWindowLength || 5) + ' }}',
          },
          position: memoryPosition,
          typeVersion: 1.3,
        };
        nodes.push(memoryNode);
      }

      if (template.integrationNodes && template.integrationNodes.length > 0) {
        template.integrationNodes.forEach((integrationNode, index) => {
          const node: N8nNode = {
            id: uuidv4(),
            name: `Integration Node ${index + 1}`,
            type: integrationNode.type,
            parameters: integrationNode.parameters,
            position: [integrationNode.position.x, integrationNode.position.y],
            typeVersion: 1,
          };
          nodes.push(node);
        });
      }

      const connections: Record<string, Record<string, Array<Array<{node: string; type: string; index: number}>>>> = {};

      connections[webhookNode.name] = {
        main: [
          [
            {
              node: agentNode.name,
              type: 'main',
              index: 0
            }
          ]
        ]
      };

      connections[agentNode.name] = {
        main: [
          [
            {
              node: responseNode.name,
              type: 'main',
              index: 0
            }
          ]
        ]
      };

      connections[modelNode.name] = {
        [N8nConnectionType.AI_LANGUAGE_MODEL]: [
          [
            {
              node: agentNode.name,
              type: N8nConnectionType.AI_LANGUAGE_MODEL,
              index: 0
            }
          ]
        ]
      };

      if (template.memoryEnabled) {
        const memoryNode = nodes.find(node => node.type === N8nAiNodeType.MEMORY_BUFFER);
        if (memoryNode) {
          connections[memoryNode.name] = {
            'ai_memory': [
              [
                {
                  node: agentNode.name,
                  type: 'ai_memory',
                  index: 0
                }
              ]
            ]
          };
        }
      }

      const workflowData = {
        name: template.name || `Webhook Workflow ${new Date().toISOString().split('T')[0]}`,
        nodes,
        connections,
        settings: {
          executionOrder: 'v1',
        },
      };

      const workflow = await this.n8nClient.updateWorkflow(workflowId, workflowData);

      await this.n8nClient.activateWorkflow(workflow.id);

      let webhookUrl = '';
      if (this.webhookBaseUrl) {
        webhookUrl = `${this.webhookBaseUrl}/webhook/${webhookId}`;
      } else {
        webhookUrl = `${this.configService.get<string>('N8N_URL')}/webhook/${webhookId}`;
      }

      return {
        workflow,
        webhookUrl,
        webhookId,
      };

    } catch (error) {
      this.logger.error(`Error updating webhook workflow: ${error.message}`);
      throw error;
    }
  }

  getWebhookUrl(webhookId: string): string {
    if (this.webhookBaseUrl) {
      return `${this.webhookBaseUrl}/webhook/${webhookId}`;
    }
    return `${this.configService.get<string>('N8N_URL')}/webhook/${webhookId}`;
  }
  
  /**
   * Update an AI agent prompt in a workflow
   * @param workflowId The ID of the workflow
   * @param newPrompt The new prompt for the AI agent
   * @returns The updated workflow
   */
  async updateAgentPrompt(workflowId: string, newPrompt: string) {
    try {
      // Get the current workflow
      const workflow = await this.n8nClient.getWorkflow(workflowId);
      
      // Find the AI agent node
      const agentNodeIndex = workflow.nodes.findIndex(
        node => node.type === N8nAiNodeType.LANGCHAIN_AGENT
      );
      
      if (agentNodeIndex === -1) {
        throw new Error(`No AI agent node found in workflow ${workflowId}`);
      }
      
      // Update the prompt
      const updatedNodes = [...workflow.nodes];
      updatedNodes[agentNodeIndex] = {
        ...updatedNodes[agentNodeIndex],
        parameters: {
          ...updatedNodes[agentNodeIndex].parameters,
          options: {
            ...updatedNodes[agentNodeIndex].parameters.options,
            systemMessage: newPrompt,
          },
        },
      };
      
      // Update the workflow
      const updatedWorkflow = await this.n8nClient.updateWorkflow(workflowId, {
        nodes: updatedNodes,
      });
      
      return updatedWorkflow;
    } catch (error) {
      this.logger.error(`Error updating agent prompt: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Add an integration node to a workflow (e.g., HTTP request, SMS, email)
   * @param workflowId The ID of the workflow
   * @param nodeType The type of integration node to add
   * @param parameters The parameters for the node
   * @param position The position of the node in the workflow canvas
   * @returns The updated workflow
   */
  async addIntegrationNode(
    workflowId: string,
    nodeType: N8nIntegrationNodeType,
    parameters: Record<string, any>,
    position: NodePosition = { x: 300, y: 80 },
  ) {
    try {
      // Get the current workflow
      const workflow = await this.n8nClient.getWorkflow(workflowId);
      
      // Create the new integration node
      const newNode: N8nNode = {
        id: uuidv4(),
        name: `${nodeType.split('.')[1] || 'Integration'} Node`,
        type: nodeType,
        parameters,
        position: [position.x, position.y],
        typeVersion: 1,
      };
      
      // Add the node to the workflow
      const updatedNodes = [...workflow.nodes, newNode];
      
      // Update the workflow
      const updatedWorkflow = await this.n8nClient.updateWorkflow(workflowId, {
        nodes: updatedNodes,
      });
      
      return {
        workflow: updatedWorkflow,
        addedNode: newNode,
      };
    } catch (error) {
      this.logger.error(`Error adding integration node: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Connect an integration node to an AI agent in a workflow
   * @param workflowId The ID of the workflow
   * @param sourceNodeId The ID of the source node
   * @param targetNodeId The ID of the target node
   * @param connectionType The type of connection
   * @returns The updated workflow
   */
  async connectNodes(
    workflowId: string,
    sourceNodeId: string,
    targetNodeId: string,
    connectionType: string = N8nConnectionType.MAIN,
  ) {
    try {
      // Get the current workflow
      const workflow = await this.n8nClient.getWorkflow(workflowId);
      
      // Make sure both nodes exist
      const sourceNodeExists = workflow.nodes.some(node => node.id === sourceNodeId);
      const targetNodeExists = workflow.nodes.some(node => node.id === targetNodeId);
      
      if (!sourceNodeExists || !targetNodeExists) {
        throw new Error(`Source or target node not found in workflow ${workflowId}`);
      }
      
      // Create the new connection
      const newConnection = {
        node: sourceNodeId,
        type: connectionType,
        index: 0,
        destination: {
          node: targetNodeId,
          type: connectionType,
          index: 0,
        },
      };
      
      // Add the connection to the workflow
      const connections = workflow.connections || {};
      const connectionsList = connections[connectionType] || [];
      
      // Check if connection already exists
      const connectionExists = connectionsList.some(
        conn =>
          conn.node === sourceNodeId &&
          conn.destination?.node === targetNodeId &&
          conn.type === connectionType
      );
      
      if (connectionExists) {
        return workflow;
      }
      
      const updatedConnections = {
        ...connections,
        [connectionType]: [...connectionsList, newConnection],
      };
      
      // Update the workflow
      const updatedWorkflow = await this.n8nClient.updateWorkflow(workflowId, {
        connections: updatedConnections,
      });
      
      return updatedWorkflow;
    } catch (error) {
      this.logger.error(`Error connecting nodes: ${error.message}`);
      throw error;
    }
  }
}
