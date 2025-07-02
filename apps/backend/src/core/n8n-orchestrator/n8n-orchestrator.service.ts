import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { N8nClient } from './n8n-client';

/**
 * Main orchestrator service for interacting with n8n
 * This service coordinates all n8n-related operations and serves as the main entry point
 * for other parts of the application to interact with n8n
 */
@Injectable()
export class N8nOrchestratorService implements OnModuleInit {
  private readonly logger = new Logger(N8nOrchestratorService.name);
  private isN8nAvailable = false;

  constructor(
    private readonly n8nClient: N8nClient,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Check n8n availability on module initialization
   */
  async onModuleInit() {
    try {
      this.isN8nAvailable = await this.n8nClient.ping();
      
      if (this.isN8nAvailable) {
        this.logger.log('Successfully connected to n8n API');
      } else {
        this.logger.warn(
          'n8n API is not available. Make sure n8n is running and the N8N_URL and N8N_API_KEY environment variables are correctly set',
        );
      }
    } catch (error) {
      this.logger.error(`Error connecting to n8n: ${error.message}`);
      this.isN8nAvailable = false;
    }
  }

  /**
   * Check if n8n is available
   * @returns Whether n8n is available
   */
  isAvailable(): boolean {
    return this.isN8nAvailable;
  }

  /**
   * Create a new workflow in n8n
   * @param name Name of the workflow
   * @param nodes Initial nodes for the workflow
   * @param connections Initial connections for the workflow
   * @returns The created workflow data
   */
  async createWorkflow(name: string, nodes?: any[], connections?: any[]) {
    this.ensureN8nIsAvailable();

    const workflowData = {
      name,
      active: false, // Start as inactive by default
      nodes: nodes || [],
      connections: connections || { main: [] },
      settings: {
        executionOrder: 'v1',
      },
    };

    return await this.n8nClient.createWorkflow(workflowData);
  }

  /**
   * Get a workflow by its ID
   * @param workflowId The ID of the workflow to get
   * @returns The workflow data
   */
  async getWorkflow(workflowId: string) {
    this.ensureN8nIsAvailable();
    return await this.n8nClient.getWorkflow(workflowId);
  }
  
  /**
   * Get a workflow directly from N8nClient with minimal abstraction
   * This method bypasses any caching or additional logic to ensure fresh data
   * @param workflowId The ID of the workflow to get
   * @returns The workflow data directly from N8N API
   */
  async getWorkflowDirect(workflowId: string) {
    this.ensureN8nIsAvailable();
    // Direct access to n8nClient to bypass any potential caching or abstraction
    return await this.n8nClient.getWorkflow(workflowId);
  }

  /**
   * Get all workflows from n8n
   * @param active Optional filter for active workflows
   * @returns Array of workflows
   */
  async getAllWorkflows(active?: boolean) {
    this.ensureN8nIsAvailable();
    return await this.n8nClient.getAllWorkflows(active);
  }

  /**
   * Update an existing workflow in n8n
   * @param workflowId The ID of the workflow to update
   * @param workflowData The new workflow data
   * @returns The updated workflow data
   */
  async updateWorkflow(workflowId: string, workflowData: any) {
    this.ensureN8nIsAvailable();
    return await this.n8nClient.updateWorkflow(workflowId, workflowData);
  }

  /**
   * Delete a workflow from n8n
   * @param workflowId The ID of the workflow to delete
   * @returns True if deletion was successful
   */
  async deleteWorkflow(workflowId: string) {
    this.ensureN8nIsAvailable();
    return await this.n8nClient.deleteWorkflow(workflowId);
  }

  /**
   * Activate a workflow in n8n
   * @param workflowId The ID of the workflow to activate
   * @returns The activated workflow data
   */
  async activateWorkflow(workflowId: string) {
    this.ensureN8nIsAvailable();
    return await this.n8nClient.activateWorkflow(workflowId);
  }

  /**
   * Deactivate a workflow in n8n
   * @param workflowId The ID of the workflow to deactivate
   * @returns The deactivated workflow data
   */
  async deactivateWorkflow(workflowId: string) {
    this.ensureN8nIsAvailable();
    return await this.n8nClient.deactivateWorkflow(workflowId);
  }

  /**
   * Execute a workflow in n8n
   * @param workflowId The ID of the workflow to execute
   * @param data Input data for the workflow execution
   * @returns The execution results
   */
  async executeWorkflow(workflowId: string, data?: any) {
    this.ensureN8nIsAvailable();
    return await this.n8nClient.executeWorkflow(workflowId, data);
  }

  /**
   * Get all registered webhooks from n8n
   * @returns Array of registered webhooks
   */
  async getRegisteredWebhooks() {
    this.ensureN8nIsAvailable();
    return await this.n8nClient.getRegisteredWebhooks();
  }

  /**
   * Ensure that n8n is available before calling API methods
   * @throws Error if n8n is not available
   */
  private ensureN8nIsAvailable() {
    if (!this.isN8nAvailable) {
      throw new Error(
        'n8n is not available. Make sure n8n is running and the N8N_URL and N8N_API_KEY environment variables are correctly set',
      );
    }
  }
}
