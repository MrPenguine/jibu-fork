import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { N8nWebhookType } from '../../integrations/n8n/n8n-types';
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
    // Enhanced logging for configuration loading
    this.logger.log('Initializing N8nClient...');
    
    // Try direct process.env access first
    const envUrl = process.env.N8N_URL;
    const envApiKey = process.env.N8N_API_KEY;
    
    this.logger.log(`Direct process.env N8N_URL: ${envUrl || 'NOT SET'}`);
    this.logger.log(`Direct process.env N8N_API_KEY: ${envApiKey ? 'FOUND (masked)' : 'NOT SET'}`);
    
    // Then try ConfigService
    this.n8nUrl = this.configService.get<string>('N8N_URL');
    this.n8nApiKey = this.configService.get<string>('N8N_API_KEY');

    // Debug output for environment variables
    this.logger.log(`ConfigService N8N_URL: ${this.n8nUrl || 'NOT SET'}`);
    this.logger.log(`ConfigService N8N_API_KEY: ${this.n8nApiKey ? 'FOUND (masked)' : 'NOT SET'}`);
    
    // List all environment keys for debugging
    const allConfigKeys = Object.keys(process.env)
      .filter(key => key.startsWith('N8N_'))
      .join(', ');
    this.logger.log(`Found n8n-related env keys: ${allConfigKeys || 'NONE'}`);
    
    // Use direct env variables if ConfigService failed
    if (!this.n8nUrl && envUrl) {
      this.logger.log('Using N8N_URL from process.env directly');
      this.n8nUrl = envUrl;
    }
    
    if (!this.n8nApiKey && envApiKey) {
      this.logger.log('Using N8N_API_KEY from process.env directly');
      this.n8nApiKey = envApiKey;
    }

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
      // Add timeout to avoid hanging requests
      timeout: 10000,
    });

    this.logger.log(`Initialized n8n client with base URL: ${this.n8nUrl}`);
  }

  /**
   * Ping n8n API to check if it's available
   * @returns true if available, false otherwise
   */
  async ping(): Promise<boolean> {
    try {
      this.logger.log(`Pinging n8n health endpoint at ${this.n8nUrl}/healthz`);
      const response = await this.httpClient.get('/healthz');
      this.logger.log(`n8n health check successful with status ${response.status}`);
      return true;
    } catch (error) {
      this.logger.error(`n8n health check failed: ${error.message}`);
      this.logger.error(`Error details: ${JSON.stringify(error.response?.data || {}, null, 2)}`);
      
      // Try a readiness endpoint as fallback
      try {
        this.logger.log('Trying alternate endpoint /healthz/readiness as fallback...');
        await this.httpClient.get('/healthz/readiness');
        this.logger.log('Readiness health check successful');
        return true;
      } catch (fallbackError) {
        this.logger.error(`Fallback healthz check also failed: ${fallbackError.message}`);
        
        // Final fallback - try direct workflow API access
        try {
          this.logger.log('Trying direct workflows API as final fallback...');
          await this.httpClient.get('/api/v1/workflows');
          this.logger.log('Direct workflows API access successful');
          return true;
        } catch (finalError) {
          this.logger.error(`All health check attempts failed: ${finalError.message}`);
          return false;
        }
      }
    }
  }

  /**
   * Get details about a specific n8n workflow
   * @param id The ID of the workflow to get
   * @returns The workflow data
   */
  async getWorkflow(id: string): Promise<any> {
    try {
      const response = await this.httpClient.get(`/api/v1/workflows/${id}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get workflow ${id}: ${error.message}`);
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
      this.logger.debug(`Creating workflow with data: ${JSON.stringify(workflowData, null, 2)}`);
      this.logger.debug(`Using N8N URL: ${this.n8nUrl}`);
      this.logger.debug(`API Key present: ${this.n8nApiKey ? 'Yes' : 'No'}`);
      
      const response = await this.httpClient.post('/api/v1/workflows', workflowData);
      this.logger.log(`Successfully created workflow with ID: ${response.data.id}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to create workflow: ${error.message}`);
      
      // Enhanced error logging for debugging
      if (error.response) {
        this.logger.error(`HTTP Status: ${error.response.status}`);
        this.logger.error(`Response Headers: ${JSON.stringify(error.response.headers, null, 2)}`);
        this.logger.error(`Response Data: ${JSON.stringify(error.response.data, null, 2)}`);
        
        if (error.response.status === 401) {
          this.logger.error('Authentication failed - checking N8N configuration:');
          this.logger.error(`N8N URL: ${this.n8nUrl}`);
          this.logger.error(`API Key length: ${this.n8nApiKey?.length || 0}`);
          this.logger.error(`API Key starts with: ${this.n8nApiKey?.substring(0, 10)}...`);
        }
      } else if (error.request) {
        this.logger.error('No response received from N8N server');
        this.logger.error(`Request config: ${JSON.stringify(error.config, null, 2)}`);
      } else {
        this.logger.error(`Request setup error: ${error.message}`);
      }
      
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
   * Get all registered webhooks in n8n
   * @returns Array of registered webhooks
   */
  async getRegisteredWebhooks(): Promise<{ data: any[] }> {
    try {
      // First, get all active workflows which might have webhooks
      const activeWorkflows = await this.getAllWorkflows(true);
      
      // For each workflow, check if it has webhook nodes
      const webhooks = [];
      
      for (const workflow of activeWorkflows) {
        if (workflow.nodes) {
          const webhookNodeTypes = [N8nWebhookType.CHAT_TRIGGER];

          for (const node of workflow.nodes) {
            if (webhookNodeTypes.includes(node.type as N8nWebhookType)) {
              // For chat trigger nodes, include the chat trigger URL
              if (node.type === N8nWebhookType.CHAT_TRIGGER) {
                const chatUrl = `${this.n8nUrl}/chat/${workflow.id}`;

                webhooks.push({
                  workflowId: workflow.id,
                  workflowName: workflow.name,
                  nodeId: node.id,
                  nodeName: node.name,
                  nodeType: node.type,
                  url: chatUrl,
                  active: workflow.active,
                });
              }
            }
          }
        }
      }
      
      this.logger.debug(`Found ${webhooks.length} registered webhooks`);
      // Return object with data property to match expected API response format
      return { data: webhooks };
    } catch (error) {
      this.logger.error(`Failed to get registered webhooks: ${error.message}`);
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
        const webhookNodeTypes = [N8nWebhookType.CHAT_TRIGGER];

        for (const node of workflow.nodes) {
          if (webhookNodeTypes.includes(node.type as N8nWebhookType)) {
            hasWebhookNodes = true;

            // For chat trigger nodes, include the chat trigger URL
            if (node.type === N8nWebhookType.CHAT_TRIGGER) {
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
