import { Injectable, Logger } from '@nestjs/common';
import { N8nWorkflowService } from './n8n-workflow.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * Service for managing nodes within n8n workflows
 * This service handles the creation, updating, and deletion of individual nodes within n8n workflows
 */
@Injectable()
export class N8nNodeService {
  private readonly logger = new Logger(N8nNodeService.name);

  constructor(private readonly n8nWorkflowService: N8nWorkflowService) {}

  /**
   * Add a node to an existing workflow
   * @param workflowId The ID of the workflow to add the node to
   * @param nodeType The type of node to add
   * @param nodeName Optional name for the node (defaults to nodeType + random ID)
   * @param parameters Parameters for the node
   * @param position Position of the node in the workflow canvas
   * @returns The updated workflow data
   */
  async addNode(
    workflowId: string,
    nodeType: string,
    nodeName?: string,
    parameters: Record<string, any> = {},
    position: { x: number; y: number } = { x: 0, y: 0 },
  ) {
    // Get the current workflow
    const workflow = await this.n8nWorkflowService.getWorkflow(workflowId);
    
    // Generate node name if not provided
    const nodeId = uuidv4().substring(0, 8);
    const generatedName = nodeName || `${nodeType}-${nodeId}`;
    
    // Create the new node
    const newNode = {
      id: nodeId,
      name: generatedName,
      type: nodeType,
      parameters,
      typeVersion: 1, // Default value, could be updated based on node type
      position,
    };
    
    // Add the new node to the workflow
    const updatedNodes = [...(workflow.nodes || []), newNode];
    
    // Update the workflow with the new node
    const updatedWorkflow = await this.n8nWorkflowService.updateWorkflow(workflowId, {
      nodes: updatedNodes,
    });
    
    this.logger.log(`Added node ${generatedName} (${nodeType}) to workflow ${workflowId}`);
    
    return {
      workflow: updatedWorkflow,
      addedNode: newNode,
    };
  }

  /**
   * Update a node in a workflow
   * @param workflowId The ID of the workflow containing the node
   * @param nodeId The ID of the node to update
   * @param updates The updates to apply to the node
   * @returns The updated workflow data
   */
  async updateNode(workflowId: string, nodeId: string, updates: Record<string, any>) {
    // Get the current workflow
    const workflow = await this.n8nWorkflowService.getWorkflow(workflowId);
    
    // Find the node to update
    const nodeIndex = workflow.nodes.findIndex((node) => node.id === nodeId);
    
    if (nodeIndex === -1) {
      throw new Error(`Node ${nodeId} not found in workflow ${workflowId}`);
    }
    
    // Update the node
    const updatedNode = {
      ...workflow.nodes[nodeIndex],
      ...updates,
    };
    
    // Replace the node in the workflow
    const updatedNodes = [...workflow.nodes];
    updatedNodes[nodeIndex] = updatedNode;
    
    // Update the workflow with the updated node
    const updatedWorkflow = await this.n8nWorkflowService.updateWorkflow(workflowId, {
      nodes: updatedNodes,
    });
    
    this.logger.log(`Updated node ${nodeId} in workflow ${workflowId}`);
    
    return {
      workflow: updatedWorkflow,
      updatedNode: updatedNode,
    };
  }

  /**
   * Delete a node from a workflow
   * @param workflowId The ID of the workflow containing the node
   * @param nodeId The ID of the node to delete
   * @returns The updated workflow data
   */
  async deleteNode(workflowId: string, nodeId: string) {
    // Get the current workflow
    const workflow = await this.n8nWorkflowService.getWorkflow(workflowId);
    
    // Find the node to delete
    const nodeExists = workflow.nodes.some((node) => node.id === nodeId);
    
    if (!nodeExists) {
      throw new Error(`Node ${nodeId} not found in workflow ${workflowId}`);
    }
    
    // Remove the node from the workflow
    const updatedNodes = workflow.nodes.filter((node) => node.id !== nodeId);
    
    // Also remove any connections involving this node
    const updatedConnections = { main: [] };
    
    if (workflow.connections && workflow.connections.main) {
      updatedConnections.main = workflow.connections.main.filter(
        (connection) => 
          connection.node !== nodeId && 
          connection.destination?.node !== nodeId
      );
    }
    
    // Update the workflow with the node removed
    const updatedWorkflow = await this.n8nWorkflowService.updateWorkflow(workflowId, {
      nodes: updatedNodes,
      connections: updatedConnections,
    });
    
    this.logger.log(`Deleted node ${nodeId} from workflow ${workflowId}`);
    
    return updatedWorkflow;
  }

  /**
   * Get a node from a workflow by ID
   * @param workflowId The ID of the workflow containing the node
   * @param nodeId The ID of the node to get
   * @returns The node data
   */
  async getNode(workflowId: string, nodeId: string) {
    // Get the current workflow
    const workflow = await this.n8nWorkflowService.getWorkflow(workflowId);
    
    // Find the node
    const node = workflow.nodes.find((node) => node.id === nodeId);
    
    if (!node) {
      throw new Error(`Node ${nodeId} not found in workflow ${workflowId}`);
    }
    
    return node;
  }

  /**
   * Map a platform Tool type to an n8n node configuration
   * @param toolType The platform tool type
   * @param parameters The parameters for the tool
   * @returns The n8n node configuration
   */
  mapToolToN8nNode(toolType: string, parameters: Record<string, any> = {}) {
    // This is a placeholder implementation
    // In a real implementation, this would map our platform's tool types to n8n node types and configurations
    
    // Example mapping (to be expanded based on available tool types)
    const toolToN8nMap: Record<string, any> = {
      'http-request': {
        type: 'n8n-nodes-base.httpRequest',
        parameters: {
          url: parameters.url || '',
          method: parameters.method || 'GET',
          authentication: 'none',
        },
      },
      'send-email': {
        type: 'n8n-nodes-base.emailSend',
        parameters: {
          to: parameters.to || '',
          subject: parameters.subject || '',
          text: parameters.body || '',
        },
      },
      // Add more mappings as needed
    };
    
    const defaultMapping = {
      type: `n8n-nodes-base.${toolType}`,
      parameters: parameters,
    };
    
    return toolToN8nMap[toolType] || defaultMapping;
  }
}
