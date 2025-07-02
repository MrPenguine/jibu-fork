import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { N8nIntegrationService } from '../../../integrations/n8n/n8n-integration.service';
import { N8nOrchestratorService } from '../../../core/n8n-orchestrator/n8n-orchestrator.service';
import { WebhookWorkflowTemplate } from '../../../integrations/n8n/n8n-types';
import axios from 'axios';

// Service for handling N8N workflow logic
@Injectable()
export class N8nService {
  private readonly logger = new Logger(N8nService.name);

  constructor(
    private readonly n8nIntegrationService: N8nIntegrationService,
    private readonly n8nOrchestratorService: N8nOrchestratorService,
    private readonly configService: ConfigService,
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

  async finalizeWebhookSetup(workflowId: string): Promise<{ status: string; message: string }> {
    this.logger.log(`[FINALIZE-SETUP] Starting setup for workflow ${workflowId}`);

    // Step 1: Fetch the workflow to get its details, especially the webhook path.
    const workflow = await this.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`[FINALIZE-SETUP] Workflow with ID ${workflowId} not found.`);
    }

    const webhookNode = workflow.nodes.find((node) => node.type === 'n8n-nodes-base.webhook');
    const webhookPath = webhookNode?.parameters.path;

    if (!webhookPath) {
      throw new Error(`[FINALIZE-SETUP] Could not find a webhook path for workflow ${workflowId}.`);
    }

    // Step 2: Poll until the webhook is registered.
    // The verifyWebhookRegistration method already contains the necessary retry logic.
    await this.verifyWebhookRegistration(webhookPath);

    this.logger.log(`[FINALIZE-SETUP] Successfully finalized setup for workflow ${workflowId}`);

    return {
      status: 'success',
      message: 'Webhook is successfully registered and ready.',
    };
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
        // The webhookId we are checking is the 'path' from the webhook node.
        // This is the primary and most reliable check.
        if (webhook?.path === webhookId) {
          return true;
        }
        
        // The following are fallbacks for other potential (less likely) formats.
        if (typeof webhook === 'string' && webhook === webhookId) {
          return true;
        }
        if (webhook?.id === webhookId) {
          return true;
        }
        if (webhook?.webhookId === webhookId) {
          return true;
        }
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
    let targetUrl = webhookUrl;

    try {
      // If a workflowId is provided, we perform a robust check to ensure it's available and active.
      // This logic also dynamically determines the correct webhook URL or triggers a chat workflow.
      if (workflowId) {
        try {
          let workflow = null;
          const maxRetries = 4;
          const retryDelay = 2500; // 2.5 seconds

          this.logger.log(`[ROBUST-FETCH] Starting robust fetch for workflow ${workflowId}`);

          // Retry loop to handle N8N API race conditions where a workflow isn't immediately available.
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            this.logger.log(`[ROBUST-FETCH] Attempt ${attempt}/${maxRetries}...`);
            try {
              await this.n8nOrchestratorService.onModuleInit(); // Refresh connection
              workflow = await this.n8nOrchestratorService.getWorkflowDirect(workflowId);
              if (workflow) {
                this.logger.log(`[ROBUST-FETCH] SUCCESS: Found workflow on attempt ${attempt}.`);
                break; // Exit loop on success
              }
            } catch (error) {
              this.logger.warn(`[ROBUST-FETCH] Attempt ${attempt} failed: ${error.message}`);
            }

            if (attempt < maxRetries) {
              this.logger.log(`[ROBUST-FETCH] Workflow not found. Waiting ${retryDelay}ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
          }

          if (!workflow) {
            const errorMsg = `FATAL: Workflow with ID ${workflowId} not found after ${maxRetries} attempts.`;
            this.logger.error(errorMsg);
            throw new Error(errorMsg);
          }

          // If the workflow is found but inactive, activate it and wait for propagation.
          if (!workflow.active) {
            this.logger.warn(`[ROBUST-FETCH] Workflow ${workflowId} is inactive. Activating...`);
            await this.n8nOrchestratorService.activateWorkflow(workflowId);
            this.logger.log(`[ROBUST-FETCH] Activated workflow. Waiting for propagation...`);
            await new Promise(resolve => setTimeout(resolve, 1500)); // Wait for activation to propagate
            
            // Re-fetch to confirm activation and get the latest state.
            workflow = await this.n8nOrchestratorService.getWorkflowDirect(workflowId);
            if (!workflow?.active) {
              this.logger.error(`[ROBUST-FETCH] FATAL: Failed to activate workflow ${workflowId}.`);
              throw new Error(`FATAL: Failed to activate workflow ${workflowId}.`);
            }
          }

          const freshWorkflow = workflow; // We have the latest workflow object.

          // Check for a Chat Trigger node first. If found, use the API to trigger, not a webhook URL.
          const chatTriggerNode = freshWorkflow.nodes?.find(node => node.type === '@n8n/n8n-nodes-langchain.chatTrigger');
          if (chatTriggerNode) {
            this.logger.log(`Found Chat Trigger node in workflow ${workflowId}. Using n8n API to trigger.`);
            const chatPayload = {
              message: testData.message || 'This is a test message from Jibu.',
              sessionId: testData.sessionId || `test-${Date.now()}`
            };
            return this.triggerChatWorkflow(workflowId, chatPayload);
          }

          // If no Chat Trigger, look for a standard webhook node to get the latest URL path.
          const webhookNode = freshWorkflow.nodes?.find(node => node.type === 'n8n-nodes-base.webhook');
          const webhookPath = webhookNode?.parameters?.path;

          if (webhookPath) {
            const n8nBaseUrl = process.env.N8N_WEBHOOK_BASE_URL || process.env.N8N_URL;
            // Always use the production URL for programmatic testing
            targetUrl = `${n8nBaseUrl}/webhook/${webhookPath}`;
            this.logger.log(`Using PRODUCTION webhook URL from workflow: ${targetUrl}`);

            // Poll to verify webhook is registered before testing
            const maxVerifyRetries = 5;
            const verifyDelay = 2000; // 2 seconds
            let isRegistered = false;
            for (let i = 1; i <= maxVerifyRetries; i++) {
              this.logger.log(`[VERIFY-WEBHOOK] Attempt ${i}/${maxVerifyRetries} to verify webhook '${webhookPath}'`);
              isRegistered = await this.verifyWebhookRegistration(webhookPath);
              if (isRegistered) {
                this.logger.log(`[VERIFY-WEBHOOK] SUCCESS: Webhook is registered.`);
                break;
              }
              if (i < maxVerifyRetries) {
                this.logger.log(`[VERIFY-WEBHOOK] Webhook not yet registered. Waiting ${verifyDelay}ms...`);
                await new Promise(resolve => setTimeout(resolve, verifyDelay));
              }
            }

            if (!isRegistered) {
              const errorMsg = `FATAL: Webhook path ${webhookPath} did not register after ${maxVerifyRetries} attempts.`;
              this.logger.error(errorMsg);
              throw new Error(errorMsg);
            }
          } else {
            this.logger.warn(`Could not find a valid webhook URL in workflow ${workflowId}. Using original URL: ${webhookUrl}`);
          }
        } catch (error) {
          this.logger.error(`Error during robust workflow check/activation for ${workflowId}: ${error.message}`);
          throw error; // Re-throw to be caught by the outer try-catch block.
        }
      }
      // Prepare the payload for the webhook test call.
      const payload = {
        message: 'This is a test message from Jibu.',
        sessionId: `test-session-${Date.now()}`,
        contextLength: 5,
        ...testData, // Allow frontend to override defaults if needed
      };
      
      // Retry logic for the actual webhook call to handle intermittent network issues or slow N8N responses.
      const maxAttempts = 3;
      const baseWaitMs = 2000;
      let lastError = null;

      // After successful verification, try to send the webhook request with retries.
      const requestPayload = {
        message: testData.message || 'This is a test payload from Jibu Console',
        sessionId: testData.sessionId || `test-session-${Date.now()}`,
        contextLength: 5,
        ...(testData.payload || {}),
      };
      const requestConfig = {
        headers: {
          'Content-Type': 'application/json',
          'X-N8N-API-KEY': this.configService.get('N8N_API_KEY'),
        },
        timeout: 15000, // 15-second timeout
      };

      this.logger.log('Composing webhook POST request:', {
        url: targetUrl,
        payload: requestPayload,
        config: requestConfig,
      });

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          this.logger.log(`Webhook POST request attempt ${attempt}/${maxAttempts} to ${targetUrl}`);
          const response = await axios.post(targetUrl, requestPayload, requestConfig);
          this.logger.log(`Webhook test successful on attempt ${attempt}. Response status: ${response.status}`);
          return response.data; // Success, return data.
        } catch (error) {
          lastError = error;
          const status = error.response?.status;
          const waitTime = baseWaitMs * attempt; // Progressive backoff

          if (status === 404 && attempt < maxAttempts) {
            this.logger.warn(`Webhook returned 404 on attempt ${attempt}, waiting ${waitTime}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }

          this.logger.error(`Webhook error on attempt ${attempt}: ${error.message}`);
          throw error; // Rethrow for other errors or the final attempt.
        }
      }

      // This part should not be reached if the loop is exited correctly.
      if (lastError) {
        this.logger.error('Exited retry loop without success.');
        throw lastError;
      }

    } catch (error) {
      this.logger.error(`Error testing webhook: ${error.message}`);

      // Enhanced error reporting for common issues.
      if (error.response) {
        const { status, data } = error.response;
        this.logger.error(`Webhook HTTP error status: ${status}`);
        if (status === 404) {
          return {
            error: 'Webhook not found. This usually means the workflow is not active or the webhook has not been registered yet.',
            status,
            hint: workflowId ? 'Try checking if the workflow is active in the N8N dashboard.' : 'Verify the webhook URL is correct.'
          };
        }
        return {
          error: `Webhook error: ${error.message}`,
          status,
          data,
          hint: 'Check N8N logs for more details about this request failure.'
        };
      }

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

      // Generic fallback error.
      return {
        error: `Webhook error: ${error.message}`,
        hint: 'Check console logs for more details.'
      };
    }
  }
}
