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
      
      const payload = {
        message: 'Hi there',
        sessionId: `test-session-${Date.now()}`,
        systemPrompt: `Your name is ${workflowName}, a helpful assistant.`,
        contextLength: 100, // Default context length of 100
        ...testData
      };
      
      // If workflowId is provided, always get the latest production webhook URL directly from the workflow
      if (workflowId) {
        try {
          const workflow = await this.n8nOrchestratorService.getWorkflow(workflowId);
          const webhookNode = workflow?.nodes?.find(node => node.type === 'n8n-nodes-base.webhook');
          
          if (webhookNode?.parameters?.webhookId) {
            const webhookId = webhookNode.parameters.webhookId;
            const n8nBaseUrl = process.env.N8N_WEBHOOK_BASE_URL || 'http://localhost:5678';
            // N8N expects the webhook URL in format: baseUrl/webhook/webhookId
            webhookUrl = `${n8nBaseUrl}/webhook/${webhookId}`;
            this.logger.log(`Using latest production webhook URL from workflow: ${webhookUrl}`);
          }
        } catch (error) {
          this.logger.error(`Failed to get latest webhook URL from workflow: ${error.message}`);
        }
      }
      
      // Verify webhook registration status with N8N
      try {
        // Extract webhook ID from URL
        const webhookIdMatch = webhookUrl.match(/\/webhook\/([^/]+)$/);
        const webhookId = webhookIdMatch ? webhookIdMatch[1] : null;
        
        if (webhookId) {
          this.logger.log(`Verifying registration for webhook ID: ${webhookId}`);
          
          // Get all registered webhooks from N8N
          const registeredHooks = await this.n8nOrchestratorService.getRegisteredWebhooks();
          
          // Check if our webhook is registered
          const isRegistered = registeredHooks?.data?.some(
            (hook) => hook.webhookId === webhookId || hook.path === webhookId
          );
          
          if (!isRegistered) {
            this.logger.warn(`⚠️ WARNING: Webhook ${webhookId} is NOT registered with N8N despite workflow being active!`);
            this.logger.warn(`This may explain the 404 errors. Registered webhooks: ${JSON.stringify(registeredHooks?.data)}`);
            
            // Try deactivating and reactivating the workflow to force webhook registration
            if (workflowId) {
              this.logger.log(`Attempting to force webhook registration by toggling workflow activation...`);
              await this.n8nOrchestratorService.deactivateWorkflow(workflowId);
              await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s
              await this.n8nOrchestratorService.activateWorkflow(workflowId);
              await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3s after activation
              
              // Check registration again
              const refreshedHooks = await this.n8nOrchestratorService.getRegisteredWebhooks();
              const isNowRegistered = refreshedHooks?.data?.some(
                (hook) => hook.webhookId === webhookId || hook.path === webhookId
              );
              
              this.logger.log(`After toggle, webhook registration status: ${isNowRegistered ? 'REGISTERED' : 'STILL NOT REGISTERED'}`);
            }
          } else {
            this.logger.log(`✅ Webhook ${webhookId} is properly registered with N8N`);
          }
        }
      } catch (regErr) {
        this.logger.error(`Failed to verify webhook registration: ${regErr.message}`);
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
      
      // Add detailed logging about the payload
      this.logger.log(`Webhook payload: ${JSON.stringify(payload)}`);  
      
      while (attemptCount < maxAttempts) {
        attemptCount++;
        try {
          this.logger.log(`Webhook request attempt ${attemptCount}/${maxAttempts} to ${targetUrl}`);
          
          // Using axios to make the request server-side with longer timeout
          const response = await axios.post(targetUrl, payload, {
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              // Add N8N specific headers that might help with webhook recognition
              'X-N8N-Test': 'true',
              ...headers,
            },
            timeout: 30000 // Increased timeout for webhook response to 30 seconds
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
