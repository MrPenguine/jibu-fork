import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

/**
 * Low-level HTTP client for interacting with the n8n REST API
 * This handles authentication and direct API calls to n8n
 */
@Injectable()
export class N8nClient {
  private readonly logger = new Logger(N8nClient.name);
  private readonly httpClient: AxiosInstance;
  private readonly n8nUrl: string;
  private readonly n8nApiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.n8nUrl = this.configService.get<string>('N8N_URL');
    this.n8nApiKey = this.configService.get<string>('N8N_API_KEY');

    // Debug output for environment variables
    this.logger.debug(`N8N_URL from env: ${this.n8nUrl || 'NOT SET'}`);
    this.logger.debug(`N8N_API_KEY from env: ${this.n8nApiKey ? 'FOUND (masked)' : 'NOT SET'}`);
    
    // List all environment keys for debugging
    const allConfigKeys = Object.keys(process.env)
      .filter(key => key.startsWith('N8N_'))
      .join(', ');
    this.logger.debug(`Found n8n-related env keys: ${allConfigKeys || 'NONE'}`);

    if (!this.n8nUrl || !this.n8nApiKey) {
      const errorMessage = 'Missing N8N_URL or N8N_API_KEY in environment configuration';
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    this.httpClient = axios.create({
      baseURL: this.n8nUrl,
      headers: {
        'X-N8N-API-KEY': this.n8nApiKey,
        'Content-Type': 'application/json',
      },
    });

    this.logger.log(`Initialized n8n client with base URL: ${this.n8nUrl}`);
  }

  /**
   * Get details about a specific n8n workflow
   * @param workflowId The ID of the workflow to get
   * @returns The workflow data
   */
  async getWorkflow(workflowId: string) {
    try {
      const response = await this.httpClient.get(`/api/v1/workflows/${workflowId}`);
      return response.data;
    } catch (error) {
      this.handleApiError('Failed to get workflow', error);
    }
  }

  /**
   * Get all workflows from n8n
   * @param active Optional filter for active workflows
   * @returns Array of workflows
   */
  async getAllWorkflows(active?: boolean) {
    try {
      const url = active !== undefined ? `/api/v1/workflows?active=${active}` : '/api/v1/workflows';
      const response = await this.httpClient.get(url);
      return response.data;
    } catch (error) {
      this.handleApiError('Failed to get workflows', error);
    }
  }

  /**
   * Create a new workflow in n8n
   * @param workflowData The workflow data to create
   * @returns The created workflow data
   */
  async createWorkflow(workflowData: any) {
    try {
      const response = await this.httpClient.post('/api/v1/workflows', workflowData);
      this.logger.log(`Successfully created workflow with ID: ${response.data.id}`);
      return response.data;
    } catch (error) {
      this.handleApiError('Failed to create workflow', error);
    }
  }

  /**
   * Update an existing workflow in n8n
   * @param workflowId The ID of the workflow to update
   * @param workflowData The new workflow data
   * @returns The updated workflow data
   */
  async updateWorkflow(workflowId: string, workflowData: any) {
    try {
      const response = await this.httpClient.put(`/api/v1/workflows/${workflowId}`, workflowData);
      this.logger.log(`Successfully updated workflow with ID: ${workflowId}`);
      return response.data;
    } catch (error) {
      this.handleApiError(`Failed to update workflow with ID: ${workflowId}`, error);
    }
  }

  /**
   * Delete a workflow from n8n
   * @param workflowId The ID of the workflow to delete
   * @returns True if deletion was successful
   */
  async deleteWorkflow(workflowId: string) {
    try {
      await this.httpClient.delete(`/api/v1/workflows/${workflowId}`);
      this.logger.log(`Successfully deleted workflow with ID: ${workflowId}`);
      return true;
    } catch (error) {
      this.handleApiError(`Failed to delete workflow with ID: ${workflowId}`, error);
    }
  }

  /**
   * Activate a workflow in n8n
   * @param workflowId The ID of the workflow to activate
   * @returns The activated workflow data
   */
  async activateWorkflow(workflowId: string) {
    try {
      const response = await this.httpClient.post(`/api/v1/workflows/${workflowId}/activate`);
      this.logger.log(`Successfully activated workflow with ID: ${workflowId}`);
      return response.data;
    } catch (error) {
      this.handleApiError(`Failed to activate workflow with ID: ${workflowId}`, error);
    }
  }

  /**
   * Deactivate a workflow in n8n
   * @param workflowId The ID of the workflow to deactivate
   * @returns The deactivated workflow data
   */
  async deactivateWorkflow(workflowId: string) {
    try {
      const response = await this.httpClient.post(`/api/v1/workflows/${workflowId}/deactivate`);
      this.logger.log(`Successfully deactivated workflow with ID: ${workflowId}`);
      return response.data;
    } catch (error) {
      this.handleApiError(`Failed to deactivate workflow with ID: ${workflowId}`, error);
    }
  }

  /**
   * Execute a workflow in n8n
   * @param workflowId The ID of the workflow to execute
   * @param data Input data for the workflow execution
   * @returns The execution results
   */
  async executeWorkflow(workflowId: string, data?: any) {
    try {
      const response = await this.httpClient.post(`/api/v1/workflows/${workflowId}/execute`, data || {});
      this.logger.log(`Successfully executed workflow with ID: ${workflowId}`);
      return response.data;
    } catch (error) {
      this.handleApiError(`Failed to execute workflow with ID: ${workflowId}`, error);
    }
  }

  /**
   * Get credentials from n8n
   * @returns Array of credentials
   */
  async getCredentials() {
    try {
      const response = await this.httpClient.get('/api/v1/credentials');
      return response.data;
    } catch (error) {
      this.handleApiError('Failed to get credentials', error);
    }
  }

  /**
   * Get registered webhooks from n8n
   * @returns Array of registered webhook details
   */
  async getRegisteredWebhooks() {
    try {
      const response = await this.httpClient.get('/api/v1/webhooks');
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get webhooks: ${error.message}`);
      // Return empty array on error instead of throwing, to make webhook checks non-blocking
      return { data: [] };
    }
  }

  /**
   * Helper method to standardize API error handling
   * @param message Error context message
   * @param error The error object from axios
   */
  private handleApiError(message: string, error: any): never {
    const statusCode = error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;
    const errorResponse = error.response?.data || { message: error.message };
    
    this.logger.error(`${message}: ${JSON.stringify(errorResponse)}`);
    
    throw new HttpException(
      {
        message: `${message}: ${errorResponse.message || 'Unknown error'}`,
        error: errorResponse,
      },
      statusCode,
    );
  }

  /**
   * Ping n8n to check if it's reachable
   * Uses the workflows endpoint since n8n doesn't have a dedicated health endpoint
   * @returns True if n8n is reachable
   */
  async ping(): Promise<boolean> {
    try {
      // Use the workflows endpoint to check if n8n is available
      // Limit=1 to minimize data transferred
      await this.httpClient.get('/api/v1/workflows?limit=1');
      this.logger.log('Successfully connected to n8n API');
      return true;
    } catch (error) {
      this.logger.error(`Failed to ping n8n: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Validates that a webhook URL is responsive
   * @param webhookUrl The webhook URL to validate
   * @returns Object with validation status and details
   */
  async validateWebhook(webhookUrl: string): Promise<{ valid: boolean; status?: number; message: string }> {
    try {
      if (!webhookUrl) {
        return { valid: false, message: 'No webhook URL provided' };
      }
      
      this.logger.debug(`Validating webhook URL: ${webhookUrl}`);
      
      // Make a POST request to the webhook URL since n8n webhooks are registered for POST
      // Include a basic test payload to ensure the webhook accepts it properly
      const testPayload = {
        body: {
          sessionId: 'test-session-id',
          chatInput: 'webhook-test-message',
          systemPrompt: 'This is a test prompt',
          temperature: 0.7
        }
      };
      
      const response = await axios.post(webhookUrl, testPayload, { timeout: 5000 });
      
      this.logger.debug(`Webhook validation successful, status: ${response.status}`);
      return { 
        valid: true, 
        status: response.status,
        message: 'Webhook URL is valid and reachable' 
      };
    } catch (error) {
      this.logger.error(`Webhook validation failed: ${error.message}`);
      
      // Log more details about the error if available
      if ((error as any).response) {
        this.logger.error(`Response status: ${(error as any).response.status}`);
        this.logger.error(`Response data: ${JSON.stringify((error as any).response.data || {})}`);
      }
      
      // Return structured information about the failure
      return {
        valid: false,
        status: (error as any).response?.status,
        message: (error as any).response 
          ? `Webhook request failed with status ${(error as any).response.status}: ${error.message}` 
          : `Webhook request failed: ${error.message}` 
      };
    }
  }
}
