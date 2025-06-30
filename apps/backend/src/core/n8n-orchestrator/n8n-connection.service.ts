import { Injectable, Logger } from '@nestjs/common';
import { N8nWorkflowService } from './n8n-workflow.service';

/**
 * Service for managing connections between nodes in n8n workflows
 * This service handles the creation, updating, and deletion of connections
 * between nodes within n8n workflows
 */
@Injectable()
export class N8nConnectionService {
  private readonly logger = new Logger(N8nConnectionService.name);

  constructor(private readonly n8nWorkflowService: N8nWorkflowService) {}

  /**
   * Add a connection between two nodes in a workflow
   * @param workflowId The ID of the workflow
   * @param sourceNodeId The ID of the source node
   * @param targetNodeId The ID of the target node
   * @param sourceOutput The output index of the source node (default: 0)
   * @param targetInput The input index of the target node (default: 0)
   * @returns The updated workflow data
   */
  async addConnection(
    workflowId: string,
    sourceNodeId: string,
    targetNodeId: string,
    sourceOutput: number = 0,
    targetInput: number = 0,
  ) {
    // Get the current workflow
    const workflow = await this.n8nWorkflowService.getWorkflow(workflowId);
    
    // Ensure both nodes exist in the workflow
    const sourceNodeExists = workflow.nodes.some((node) => node.id === sourceNodeId);
    const targetNodeExists = workflow.nodes.some((node) => node.id === targetNodeId);
    
    if (!sourceNodeExists) {
      throw new Error(`Source node ${sourceNodeId} not found in workflow ${workflowId}`);
    }
    
    if (!targetNodeExists) {
      throw new Error(`Target node ${targetNodeId} not found in workflow ${workflowId}`);
    }
    
    // Initialize connections if they don't exist
    const connections = workflow.connections || { main: [] };
    
    // Create the new connection
    const newConnection = {
      node: sourceNodeId,
      type: 'main',
      index: sourceOutput,
      destination: {
        node: targetNodeId,
        type: 'main',
        index: targetInput,
      },
    };
    
    // Check if the connection already exists
    const connectionExists = connections.main.some(
      (conn) => 
        conn.node === sourceNodeId &&
        conn.index === sourceOutput &&
        conn.destination?.node === targetNodeId &&
        conn.destination?.index === targetInput
    );
    
    if (connectionExists) {
      this.logger.warn(
        `Connection from ${sourceNodeId}:${sourceOutput} to ${targetNodeId}:${targetInput} already exists in workflow ${workflowId}`,
      );
      return workflow;
    }
    
    // Add the new connection
    const updatedConnections = {
      main: [...connections.main, newConnection],
    };
    
    // Update the workflow with the new connection
    const updatedWorkflow = await this.n8nWorkflowService.updateWorkflow(workflowId, {
      connections: updatedConnections,
    });
    
    this.logger.log(
      `Added connection from node ${sourceNodeId}:${sourceOutput} to ${targetNodeId}:${targetInput} in workflow ${workflowId}`,
    );
    
    return updatedWorkflow;
  }

  /**
   * Remove a connection between two nodes in a workflow
   * @param workflowId The ID of the workflow
   * @param sourceNodeId The ID of the source node
   * @param targetNodeId The ID of the target node
   * @param sourceOutput The output index of the source node (default: 0)
   * @param targetInput The input index of the target node (default: 0)
   * @returns The updated workflow data
   */
  async removeConnection(
    workflowId: string,
    sourceNodeId: string,
    targetNodeId: string,
    sourceOutput: number = 0,
    targetInput: number = 0,
  ) {
    // Get the current workflow
    const workflow = await this.n8nWorkflowService.getWorkflow(workflowId);
    
    // Check if connections exist
    if (!workflow.connections || !workflow.connections.main) {
      this.logger.warn(`No connections found in workflow ${workflowId}`);
      return workflow;
    }
    
    // Filter out the connection to remove
    const updatedConnections = {
      main: workflow.connections.main.filter(
        (conn) => 
          !(
            conn.node === sourceNodeId &&
            conn.index === sourceOutput &&
            conn.destination?.node === targetNodeId &&
            conn.destination?.index === targetInput
          )
      ),
    };
    
    // Check if any connection was actually removed
    if (updatedConnections.main.length === workflow.connections.main.length) {
      this.logger.warn(
        `Connection from ${sourceNodeId}:${sourceOutput} to ${targetNodeId}:${targetInput} not found in workflow ${workflowId}`,
      );
      return workflow;
    }
    
    // Update the workflow with the connection removed
    const updatedWorkflow = await this.n8nWorkflowService.updateWorkflow(workflowId, {
      connections: updatedConnections,
    });
    
    this.logger.log(
      `Removed connection from node ${sourceNodeId}:${sourceOutput} to ${targetNodeId}:${targetInput} in workflow ${workflowId}`,
    );
    
    return updatedWorkflow;
  }

  /**
   * Get all connections in a workflow
   * @param workflowId The ID of the workflow
   * @returns The connections data
   */
  async getConnections(workflowId: string) {
    // Get the current workflow
    const workflow = await this.n8nWorkflowService.getWorkflow(workflowId);
    
    // Return the connections or an empty object if none exist
    return workflow.connections || { main: [] };
  }

  /**
   * Clear all connections in a workflow
   * @param workflowId The ID of the workflow
   * @returns The updated workflow data
   */
  async clearConnections(workflowId: string) {
    // Update the workflow with empty connections
    const updatedWorkflow = await this.n8nWorkflowService.updateWorkflow(workflowId, {
      connections: { main: [] },
    });
    
    this.logger.log(`Cleared all connections in workflow ${workflowId}`);
    
    return updatedWorkflow;
  }

  /**
   * Get all connections for a specific node
   * @param workflowId The ID of the workflow
   * @param nodeId The ID of the node
   * @returns Object with incoming and outgoing connections
   */
  async getNodeConnections(workflowId: string, nodeId: string) {
    // Get the current workflow
    const workflow = await this.n8nWorkflowService.getWorkflow(workflowId);
    
    // Check if connections exist
    if (!workflow.connections || !workflow.connections.main) {
      return { incoming: [], outgoing: [] };
    }
    
    // Filter connections for the specified node
    const outgoingConnections = workflow.connections.main.filter(
      (conn) => conn.node === nodeId
    );
    
    const incomingConnections = workflow.connections.main.filter(
      (conn) => conn.destination?.node === nodeId
    );
    
    return { incoming: incomingConnections, outgoing: outgoingConnections };
  }
}
