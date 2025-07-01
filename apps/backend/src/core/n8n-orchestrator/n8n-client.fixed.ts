import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { v4 as uuidv4 } from 'uuid';

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
   * Ping n8n API to check if it's available
   * @returns true if available, false otherwise
   */
  async ping(): Promise<boolean> {
    try {
      await this.httpClient.get('/api/v1/health');
      return true;
    } catch (error) {
      this.logger.warn(`n8n health check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Get details about a specific n8n workflow
   * @param id The ID of the workflow to get
   * @returns The workflow data
   */
  async getWorkflow(id: string): Promise<any> {
    try {
      const response = await this.httpClient.get(`/api/v1/workflows/${id}`);
      return response.data.data;
    } catch (error) {
      this.logger.error(`Failed to get workflow with ID: ${id}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all workflows from n8n
   * @param activeOnly Optional filter for active workflows
   * @returns Array of workflows
   */
  async getAllWorkflows(activeOnly = false): Promise<any[]> {
    try {
      const url = activeOnly ? '/api/v1/workflows?active=true' : '/api/v1/workflows';
      const response = await this.httpClient.get(url);
      return response.data.data;
    } catch (error) {
      this.logger.error(`Failed to get workflows: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a new workflow in n8n
   * @param workflowData The workflow data to create
   * @returns The created workflow data
   */
  async createWorkflow(workflowData: any): Promise<any> {
    try {
      const response = await this.httpClient.post('/api/v1/workflows', workflowData);
      this.logger.log(`Successfully created workflow with ID: ${response.data.id}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to create workflow: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update an existing workflow in n8n
   * @param workflowId The ID of the workflow to update
   * @param workflowData The new workflow data
   * @returns The updated workflow data
   */
  async updateWorkflow(workflowId: string, workflowData: any): Promise<any> {
    try {
      const response = await this.httpClient.put(`/api/v1/workflows/${workflowId}`, workflowData);
      this.logger.log(`Successfully updated workflow with ID: ${workflowId}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to update workflow: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete a workflow from n8n
   * @param workflowId The ID of the workflow to delete
   * @returns The deleted workflow data
   */
  async deleteWorkflow(workflowId: string): Promise<any> {
    try {
      const response = await this.httpClient.delete(`/api/v1/workflows/${workflowId}`);
      this.logger.log(`Successfully deleted workflow with ID: ${workflowId}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to delete workflow: ${error.message}`);
      throw error;
    }
  }

  /**
   * Activate a workflow in n8n
   * @param workflowId The ID of the workflow to activate
   * @returns The activated workflow data
   */
  async activateWorkflow(workflowId: string): Promise<any> {
    try {
      const response = await this.httpClient.post(`/api/v1/workflows/${workflowId}/activate`);
      this.logger.log(`Successfully activated workflow with ID: ${workflowId}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to activate workflow: ${error.message}`);
      throw error;
    }
  }

  /**
   * Deactivate a workflow in n8n
   * @param workflowId The ID of the workflow to deactivate
   * @returns The deactivated workflow data
   */
  async deactivateWorkflow(workflowId: string): Promise<any> {
    try {
      const response = await this.httpClient.post(`/api/v1/workflows/${workflowId}/deactivate`);
      this.logger.log(`Successfully deactivated workflow with ID: ${workflowId}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to deactivate workflow: ${error.message}`);
      throw error;
    }
  }

  /**
   * Trigger a chat workflow via the N8N Chat Trigger node API
   * This is for workflows using Chat Trigger nodes
   * 
   * @param workflowId The ID of the workflow to trigger
   * @param data The data to send to the workflow (typically chat messages and metadata)
   * @returns The workflow execution results
   */
  async triggerChatWorkflow(workflowId: string, data: any): Promise<any> {
    try {
      // Generate a unique session ID if one is not provided
      if (!data.sessionId) {
        data.sessionId = uuidv4();
        this.logger.debug(`Generated new session ID for chat workflow: ${data.sessionId}`);
      }

      const url = `${this.n8nUrl}/chat/${workflowId}`;
      this.logger.debug(`Triggering chat workflow at: ${url}`);
      this.logger.debug(`With payload: ${JSON.stringify(data)}`);

      const response = await axios.post(url, data, {
        headers: {
          'Content-Type': 'application/json',
          'X-N8N-API-KEY': this.n8nApiKey,
        },
      });

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to trigger chat workflow: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute a workflow in n8n
   * @param workflowId The ID of the workflow to execute
   * @param data Optional data to pass to the workflow
   * @returns The execution results
   */
  async executeWorkflow(workflowId: string, data?: any): Promise<any> {
    try {
      const response = await this.httpClient.post(`/api/v1/workflows/${workflowId}/execute`, data || {});
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to execute workflow: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all credentials stored in n8n
   * @returns Array of credentials
   */
  async getCredentials(): Promise<any> {
    try {
      const response = await this.httpClient.get('/api/v1/credentials');
      return response.data.data;
    } catch (error) {
      this.logger.error(`Failed to get credentials: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate if a webhook is properly registered with n8n
   * @param workflowId The ID of the workflow the webhook belongs to
   * @returns Object with validation results
   */
  async validateWebhook(workflowId: string): Promise<any> {
    try {
      // First, get the workflow to ensure it exists and is active
      const workflow = await this.getWorkflow(workflowId);
      
      if (!workflow) {
        return {
          valid: false,
          message: `Workflow with ID ${workflowId} does not exist`,
        };
      }
      
      if (!workflow.active) {
        return {
          valid: false,
          message: `Workflow with ID ${workflowId} exists but is not active`,
          workflow,
        };
      }
      
      // Check if this workflow has webhook nodes
      let hasWebhookNodes = false;
      let webhookUrls: string[] = [];
      
      // Simple check for nodes with webhook functionality
      if (workflow.nodes) {
        const webhookNodeTypes = ['n8n-nodes-base.webhook', 'n8n-nodes-base.chatTrigger'];
        
        for (const node of workflow.nodes) {
          if (webhookNodeTypes.includes(node.type)) {
            hasWebhookNodes = true;
            
            // For webhook nodes, try to extract the webhook URL if available
            if (node.type === 'n8n-nodes-base.webhook' && node.parameters?.path) {
              // Construct webhook URL based on n8n configuration
              const webhookPath = node.parameters.path;
              const webhookUrl = `${this.n8nUrl}/webhook/${workflowId}/${webhookPath}`;
              webhookUrls.push(webhookUrl);
            }
            
            // For chat trigger nodes, include the chat trigger URL
            if (node.type === 'n8n-nodes-base.chatTrigger') {
              const chatUrl = `${this.n8nUrl}/chat/${workflowId}`;
              webhookUrls.push(chatUrl);
            }
          }
        }
      }
      
      if (!hasWebhookNodes) {
        return {
          valid: false,
          message: `Workflow with ID ${workflowId} does not contain any webhook or chat trigger nodes`,
          workflow,
        };
      }
      
      return {
        valid: true,
        message: `Workflow with ID ${workflowId} is active and contains webhook/chat trigger nodes`,
        webhookUrls,
        workflow,
      };
    } catch (error) {
      this.logger.error(`Failed to verify webhook registration for workflow ${workflowId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Test a webhook URL
   * @param webhookUrl The webhook URL to test
   * @param workflowId Optional workflow ID for extended validation
   * @param payload Optional payload to send with the test request
   * @returns Object with test results
   */
  async testWebhook(webhookUrl: string, workflowId?: string, payload?: any): Promise<any> {
    try {
      if (!webhookUrl) {
        throw new Error('Webhook URL is required');
      }
      
      // Prepare payload or use default
      const testPayload = payload || { test: true, timestamp: Date.now() };
      
      // Try to activate workflow if workflowId is provided
      if (workflowId) {
        try {
          // Get workflow status
          const workflow = await this.getWorkflow(workflowId);
          if (!workflow?.active) {
            this.logger.log(`Workflow ${workflowId} is not active, activating it...`);
            await this.activateWorkflow(workflowId);
          }
        } catch (activateError) {
          this.logger.error(`Failed to activate workflow ${workflowId}: ${activateError.message}`);
          // Continue with test even if activation fails
        }
      }
      
      // Define retry parameters
      const maxRetries = 3;
      const retryDelay = 1000; // 1 second base delay
      
      // Try up to maxRetries times to verify the webhook
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          this.logger.log(`Testing webhook URL (attempt ${attempt}/${maxRetries}): ${webhookUrl}`);
          
          // Make the actual webhook request
          const response = await axios.post(webhookUrl, testPayload, {
            validateStatus: () => true, // Accept any status code
            timeout: 10000, // 10 seconds timeout
            headers: {
              'Content-Type': 'application/json',
              'X-Webhook-Test': 'true'
            }
          });
          
          this.logger.debug(`Webhook validation successful on attempt ${attempt}, status: ${response.status}`);
          return { 
            valid: true, 
            status: response.status,
            message: `Webhook URL is valid and reachable (verified on attempt ${attempt})` 
          };
        } catch (error: any) {
          const status = error.response?.status;
          
          // Log the error for debugging
          if (error.response) {
            this.logger.warn(`Webhook attempt ${attempt} failed with status ${status}: ${error.message}`);
            if (error.response.data) {
              this.logger.debug(`Response data: ${JSON.stringify(error.response.data || {})}`);
            }
          } else {
            this.logger.warn(`Webhook attempt ${attempt} failed: ${error.message}`);
          }
          
          // If this was the last attempt, or we got something other than a 404 (which might indicate webhook not registered yet)
          if (attempt === maxRetries || (status && status !== 404)) {
            // Return with failure
            return {
              valid: false,
              status: status,
              message: status === 404
                ? `Webhook not registered with N8N despite ${maxRetries} attempts. Check workflow activation status and webhook node configuration.`
                : `Webhook request failed with status ${status || 'unknown'}: ${error.message}`
            };
          }
          
          // Otherwise wait and retry
          const waitTime = retryDelay * attempt; // Exponential backoff
          this.logger.debug(`Waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
      
      // This should never be reached due to the loop logic, but TypeScript needs a return
      return {
        valid: false,
        message: 'Webhook validation failed after all retry attempts'
      };
    } catch (error: any) {
      this.logger.error(`Unexpected error testing webhook URL: ${error.message}`);
      throw error;
    }
  }
}
