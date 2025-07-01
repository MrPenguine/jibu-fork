import { Injectable, Logger } from '@nestjs/common';
import { N8nIntegrationService } from '../../../integrations/n8n/n8n-integration.service';
import { N8nOrchestratorService } from '../../../core/n8n-orchestrator/n8n-orchestrator.service';
import { WebhookWorkflowTemplate } from '../../../integrations/n8n/n8n-types';
import axios from 'axios';

@Injectable()
export class N8nService {
  private readonly logger = new Logger(N8nService.name);

  constructor(
    private readonly n8nIntegrationService: N8nIntegrationService,
    private readonly n8nOrchestratorService: N8nOrchestratorService,
  ) {}

  async checkStatus() {
    const isAvailable = this.n8nOrchestratorService.isAvailable();
    return {
      status: isAvailable ? 'connected' : 'disconnected',
      message: isAvailable
        ? 'Successfully connected to n8n API'
        : 'Failed to connect to n8n API. Please check your configuration.',
    };
  }

  async getAllWorkflows() {
    return this.n8nOrchestratorService.getAllWorkflows();
  }

  async createWebhookWorkflow(template: WebhookWorkflowTemplate) {
    return this.n8nIntegrationService.createWebhookWorkflow(template);
  }

  async getWorkflow(id: string) {
    return this.n8nOrchestratorService.getWorkflow(id);
  }

  async deleteWorkflow(id: string) {
    return this.n8nOrchestratorService.deleteWorkflow(id);
  }

  async activateWorkflow(id: string) {
    return this.n8nOrchestratorService.activateWorkflow(id);
  }

  async deactivateWorkflow(id: string) {
    return this.n8nOrchestratorService.deactivateWorkflow(id);
  }

  async updateAgentPrompt(id: string, prompt: string) {
    return this.n8nIntegrationService.updateAgentPrompt(id, prompt);
  }
  
  /**
   * Triggers a workflow that uses a Chat Trigger node via the n8n API
   * @param workflowId The ID of the workflow to trigger
   * @param payload The data payload to send to the workflow
   * @returns The workflow execution result
   */
  async triggerChatWorkflow(workflowId: string, payload: Record<string, any>) {
    try {
      // The direct API endpoint for triggering a chat workflow
      // Format: n8n-url/api/v1/workflows/{id}/trigger
      const n8nBaseUrl = process.env.N8N_URL || 'http://localhost:5678';
      const n8nApiKey = process.env.N8N_API_KEY;
      
      // Construct the API URL for triggering the workflow
      const triggerUrl = `${n8nBaseUrl}/api/v1/workflows/${workflowId}/trigger`;
      
      this.logger.log(`Triggering chat workflow ${workflowId} via API at: ${triggerUrl}`);
      
      // Make the API request to trigger the workflow
      const response = await axios({
        method: 'post',
        url: triggerUrl,
        data: {
          // For chat triggers, we need to format the data differently than for webhooks
          // The actual structure may vary depending on your workflow setup
          message: payload.message,
          sessionId: payload.sessionId,
          systemPrompt: payload.systemPrompt,
          contextLength: payload.contextLength || 5,
          // Include any other fields needed by your workflow
        },
        headers: {
          'Content-Type': 'application/json',
          'X-N8N-API-KEY': n8nApiKey, // Include API key for authentication if required
        },
        timeout: 15000 // 15 second timeout
      });
      
      this.logger.log(`Chat workflow triggered successfully. Response status: ${response.status}`);
      
      // Log response details for debugging
      if (typeof response.data === 'object') {
        this.logger.log(`Response data: ${JSON.stringify(response.data)}`);
      } else {
        this.logger.log(`Response data received (non-JSON format)`);
      }
      
      return response.data;
    } catch (error) {
      this.logger.error(`Error triggering chat workflow: ${error.message}`);
      
      if (error.response) {
        const { status, data } = error.response;
        this.logger.error(`API error status: ${status}`);
        this.logger.error(`API error data: ${JSON.stringify(data)}`);
      }
      
      throw new Error(`Failed to trigger chat workflow: ${error.message}`);
    }
  }
  
  /**
   * Verifies if a webhook is registered with N8N
   * @param webhookId The webhook ID to verify
   * @returns True if the webhook is registered, false otherwise
   */
  async verifyWebhookRegistration(webhookId: string): Promise<boolean> {
    try {
      const webhooksResponse = await this.n8nOrchestratorService.getRegisteredWebhooks();
      
      // Log the registered webhooks for debugging
      this.logger.log(`Checking for webhook registration: ${webhookId}`);
      this.logger.log(`Retrieved webhooks response: ${JSON.stringify(webhooksResponse)}`);
      
      // Handle n8n API response format which contains a data property
      const registeredWebhooks = webhooksResponse?.data || [];
      
      if (!Array.isArray(registeredWebhooks)) {
        this.logger.error('Invalid webhooks response format - expected array in data property');
        return false;
      }
      
      // Enhanced verification for different webhook formats
      const isRegistered = registeredWebhooks.some(webhook => {
        // Direct webhook ID match
        if (typeof webhook === 'string') {
          return webhook === webhookId;
        }
        
        // Standard webhook object with ID property
        if (webhook?.id === webhookId) {
          return true;
        }
        
        // Chat trigger with webhookId property
        if (webhook?.webhookId === webhookId) {
          return true;
        }
        
        // Match by triggerRef for chat triggers
        if (webhook?.triggerRef === webhookId) {
          return true;
        }
        
        return false;
      });
      
      if (isRegistered) {
        this.logger.log(`✅ Webhook ${webhookId} is registered with n8n`);
      } else {
        this.logger.warn(`⚠️ Webhook ${webhookId} is NOT registered with n8n`);
      }
      
      return isRegistered;
    } catch (error) {
      this.logger.error(`Failed to verify webhook registration: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Test a webhook by calling it with data
   * @param webhookUrl The webhook URL to test
   * @param workflowId Optional workflow ID to check activation status
   * @param testData Additional data to send with the request
   * @param headers Optional custom headers for the request
   * @param useTestUrl Whether to use the test URL (deprecated, kept for compatibility)
   */
  async testWebhook(
    webhookUrl: string, 
    workflowId?: string, 
    testData: Record<string, any> = {}, 
    headers: Record<string, string> = {},
    // Always use production URL (useTestUrl parameter is deprecated but kept for compatibility)
    useTestUrl = false
  ) {
    
    try {
      // If we have a workflowId, check if it's active first
      if (workflowId) {
        try {
          const workflow = await this.n8nOrchestratorService.getWorkflow(workflowId);
          
          // If workflow exists but is not active, activate it
          if (!workflow.active) {
            this.logger.log(`Workflow ${workflowId} is not active. Attempting to activate...`);
            
            // Check if there's an existing activation attempt in progress
            // This helps avoid race conditions with multiple webhook test requests
            const activationKey = `n8n:activation:${workflowId}`;
            
            try {
              // Activate the workflow
              await this.n8nOrchestratorService.activateWorkflow(workflowId);
              
              // Log detailed activation process
              this.logger.log(`Activation request sent for workflow ${workflowId}`);
              
              // Wait for webhook registration after activation with more robust polling
              this.logger.log(`Waiting for webhook to register after activation...`);
              
              let isActive = false;
              let retries = 0;
              const maxRetries = 5;
              const baseWaitMs = 1000;
              
              // Wait for workflow to become active
              while (!isActive && retries < maxRetries) {
                // Wait with exponential backoff
                const waitTime = baseWaitMs * Math.pow(2, retries);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                retries++;
                
                try {
                  const updatedWorkflow = await this.n8nOrchestratorService.getWorkflow(workflowId);
                  isActive = updatedWorkflow?.active;
                  if (isActive) break;
                  this.logger.log(`Checking activation status (attempt ${retries}/${maxRetries})...`);
                } catch (err) {
                  this.logger.error(`Error checking workflow status during retry ${retries}: ${err.message}`);
                }
              }
              
              if (!isActive) {
                this.logger.error(`Failed to activate workflow ${workflowId} after ${maxRetries} retries`);
                throw new Error('Workflow activation failed or timed out');
              } else {
                this.logger.log(`Workflow ${workflowId} successfully activated after ${retries} checks`);
              }
            } catch (activationError) {
              this.logger.error(`Error during workflow activation: ${activationError.message}`);
              throw activationError;
            }
          } else {
            this.logger.log(`Workflow ${workflowId} is already active`);
          }
        } catch (error) {
          this.logger.error(`Error checking/activating workflow: ${error.message}`);
          if (error.response?.status === 404) {
            throw new Error(`Workflow with ID ${workflowId} not found`);
          }
          throw error;
        }
      }
      
      let workflowName = 'AI Assistant';
      
      // If workflowId is provided, get the workflow name
      if (workflowId) {
        try {
          const workflow = await this.n8nOrchestratorService.getWorkflow(workflowId);
          if (workflow?.name) {
            workflowName = workflow.name;
          }
        } catch (error) {
          this.logger.warn(`Could not get workflow name: ${error.message}`);
        }
      }
      
      const sessionId = `test-session-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
      const payload = {
        message: 'Hi there',
        sessionId: sessionId,
        systemPrompt: `Your name is ${workflowName}, a helpful assistant to help with scheduling.`,
        contextLength: 100, // Default context length of 100
        ...testData
      };
      
      this.logger.log(`Webhook payload: ${JSON.stringify(payload)}`);  
      
      // If workflowId is provided, always get the latest production webhook URL or chat trigger directly from the workflow
      if (workflowId) {
        try {
          const workflow = await this.n8nOrchestratorService.getWorkflow(workflowId);
          
          if (!workflow) {
            throw new Error(`Workflow with ID ${workflowId} not found`);
          }
          
          if (!workflow.active) {
            this.logger.log(`Workflow ${workflowId} is not active - activating now...`);
            await this.n8nOrchestratorService.activateWorkflow(workflowId);
            this.logger.log(`Workflow ${workflowId} activated`);
            // Short delay to allow activation to complete
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          
          // Check for chat trigger node first (new format)
          const chatTriggerNode = workflow?.nodes?.find(node => node.type === '@n8n/n8n-nodes-langchain.chatTrigger');
          if (chatTriggerNode) {
            this.logger.log(`Found Chat Trigger node in workflow ${workflowId}. Using n8n API to trigger workflow instead of webhook URL`);
            
            // For chat triggers, we'll use the n8n API instead of webhook URLs
            return await this.triggerChatWorkflow(workflowId, payload);
          }
          
          // Fall back to webhook node (legacy format)
          const webhookNode = workflow?.nodes?.find(node => node.type === 'n8n-nodes-base.webhook');
          if (webhookNode?.parameters?.webhookId) {
            const webhookId = webhookNode.parameters.webhookId;
            
            // IMPORTANT: The correct n8n webhook URL format
            // Format must be: {n8n_base_url}/webhook/{webhook_id}
            // NOT: {n8n_base_url}/{workflow_id}/webhook/{webhook_id}
            const n8nBaseUrl = process.env.N8N_WEBHOOK_BASE_URL || 'http://localhost:5678';
            webhookUrl = `${n8nBaseUrl}/webhook/${webhookId}`;
            
            this.logger.log(`Using correct n8n webhook URL format: ${webhookUrl}`);
            
            // Don't attempt to verify webhook registration via API since it's unreliable
            // Instead, we'll directly try to call the webhook and handle errors appropriately
          } else {
            this.logger.warn(`No webhook or chat trigger node found in workflow ${workflowId}`);
          }
        } catch (error) {
          this.logger.error(`Failed to get latest webhook/chat trigger info from workflow: ${error.message}`);
        }
      }
      
      // Skip webhook registration verification since it's unreliable
      // Instead focus on direct webhook testing with proper URL format
      try {
        // Extract webhook ID from URL for logging purposes
        const webhookUrlParts = webhookUrl.split('/');
        const targetWebhookId = webhookUrlParts[webhookUrlParts.length - 1];
        
        this.logger.log(`Preparing to test webhook with ID: ${targetWebhookId}`);
        
        if (workflowId) {
          // Ensure the workflow is active before trying to call the webhook
          const workflow = await this.n8nOrchestratorService.getWorkflow(workflowId);
          if (workflow && !workflow.active) {
            this.logger.log(`Activating workflow ${workflowId} before webhook test`);
            await this.n8nOrchestratorService.activateWorkflow(workflowId);
            // Brief delay to allow activation to complete
            await new Promise(resolve => setTimeout(resolve, 1500));
            this.logger.log(`Workflow activated, proceeding with webhook test`);
          } else {
            this.logger.log(`Workflow ${workflowId} is already active, proceeding with webhook test`);
          }
        }
      } catch (regErr) {
        this.logger.warn(`Non-fatal issue during webhook preparation: ${regErr.message}`);
        this.logger.log(`Proceeding with webhook test anyway`);
      }
      
      // Log the request being made
      this.logger.log(`Sending test request to webhook: ${webhookUrl}`);
      
      // Always use the production webhook URL format for programmatic testing
      // This ensures we're targeting the URL that's always listening when workflow is active
      let targetUrl = webhookUrl;
      
      // If URL is somehow still in test format, convert to production format
      if (webhookUrl.includes('/webhook-test/')) {
        targetUrl = webhookUrl.replace('/webhook-test/', '/webhook/');
        this.logger.log(`Converting to production webhook URL: ${targetUrl}`);
      }
      
      // For production webhook, add a timestamp to session ID to help with caching/testing
      if (payload && payload.sessionId) {
        if (!payload.sessionId.includes(Date.now().toString().slice(-6))) {
          payload.sessionId = `${payload.sessionId}-${Date.now().toString().slice(-6)}`;
          this.logger.log(`Updated sessionId to: ${payload.sessionId}`);
        }
      }
      
      // Enhanced retry logic with progressive backoff
      const maxAttempts = 5; // Increased from 3 to 5 attempts
      const baseWaitMs = 3000; // Base wait time between retries
      let attemptCount = 0;
      let lastError = null;
      
      // Extract webhook ID from URL to help with troubleshooting
      const webhookUrlParts = webhookUrl.split('/');
      const targetWebhookId = webhookUrlParts[webhookUrlParts.length - 1];
      
      this.logger.log(`Sending test request to webhook: ${webhookUrl}`);
      
      while (attemptCount < maxAttempts) {
        attemptCount++;
        try {
          this.logger.log(`Webhook request attempt ${attemptCount}/${maxAttempts} to ${targetUrl}`);
          
          // Using axios to make the request server-side with longer timeout
          // Make the HTTP request to the webhook endpoint
          const response = await axios({
            method: 'post',
            url: targetUrl,
            data: payload,
            headers: {
              'Content-Type': 'application/json',
              'X-Webhook-Test': 'true',  // Mark this as a test request
              ...headers
            },
            timeout: 15000 // 15 second timeout for potentially slow systems
          });
          
          // If successful, return the response
          this.logger.log(`Webhook test successful on attempt ${attemptCount}. Response status: ${response.status}`);
          
          // Log response details for debugging
          if (typeof response.data === 'object') {
            this.logger.log(`Response data: ${JSON.stringify(response.data)}`); 
          } else {
            this.logger.log(`Response data received (non-JSON format)`);
          }
          
          return response.data;
        } catch (error) {
          lastError = error;
          const status = error.response?.status;
          
          // Progressive backoff - wait longer with each retry
          const waitTime = baseWaitMs * attemptCount;
          
          // If it's a 404 and we have more attempts, wait and retry
          if ((status === 404 || status === 400) && attemptCount < maxAttempts) {
            this.logger.warn(`Webhook returned ${status} on attempt ${attemptCount}, waiting ${waitTime}ms before retry...`);
            
            // Log detailed error for debugging
            if (error.response?.data) {
              this.logger.warn(`Response data: ${JSON.stringify(error.response.data)}`);
            }
            
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
          
          // For other errors or final attempt, break the loop to handle the error
          this.logger.error(`Webhook error on final attempt ${attemptCount}: ${error.message}`);
          
          // Re-throw the last error to be caught by the outer catch block
          throw error;
        }
      }
      
      // If we somehow exit the loop without a success or thrown error
      if (lastError) {
        this.logger.error('Exited retry loop without success or proper error handling');
        throw lastError;
      }
      
      // This code shouldn't be reached - all cases should be handled above
      this.logger.error('Unexpected code path in webhook test function');
      return { 
        error: 'An unexpected error occurred in the webhook test function',
        hint: 'This is likely a bug in the webhook test implementation.'
      };
    } catch (error) {
      this.logger.error(`Error testing webhook: ${error.message}`);
      
      // Enhanced error reporting for common webhook issues
      if (error.response) {
        const { status, data } = error.response;
        this.logger.error(`Webhook HTTP error status: ${status}`);
        
        if (status === 404) {
          // 404 likely means the workflow is not active or webhook not registered
          return { 
            error: 'Webhook not found. This usually means the workflow is not active, or the webhook has not been registered yet.', 
            status,
            hint: workflowId 
              ? 'Try checking if the workflow is active in the N8N dashboard or inspect timing between activation and testing.' 
              : 'Verify the webhook URL is correct.'
          };
        }
        
        // Return detailed error information for better debugging
        return { 
          error: `Webhook error: ${error.message}`, 
          status, 
          data,
          hint: 'Check N8N logs for more details about this request failure.'
        };
      }
      
      // For network or timeout errors
      if (error.code === 'ECONNREFUSED') {
        return { 
          error: `Connection refused: ${error.message}`, 
          hint: 'Check if the N8N server is running and accessible.'
        };
      } else if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
        return { 
          error: `Request timed out: ${error.message}`, 
          hint: 'The N8N server may be overloaded or the workflow execution is taking too long.'
        };
      }
      
      return { 
        error: `Webhook error: ${error.message}`,
        hint: 'Check console logs for more details.'
      };
    }
  }
}
