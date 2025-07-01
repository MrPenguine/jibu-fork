import { fetchAPI } from './api';

// Types for N8N workflow operations
export interface WebhookWorkflowTemplate {
  name: string;
  webhookPath: string;
  webhookMethod: string;
  agentPrompt?: string;
  memoryEnabled?: boolean;
}

export interface N8nWorkflowResponse {
  id: string;
  name: string;
  active: boolean;
  nodes: any[];
  connections: any;
  webhookUrl?: string;
  settings?: any;
  versionId?: string;
  meta?: any;
  tags?: string[];
}

export interface N8nStatusResponse {
  status: 'connected' | 'disconnected';
  message: string;
}

/**
 * Check N8N connection status
 */
export async function checkN8nStatus(): Promise<N8nStatusResponse> {
  try {
    const response = await fetchAPI('/v1/n8n/status');
    return response;
  } catch (error) {
    console.error('Error checking N8N status:', error);
    throw new Error('Failed to check N8N status');
  }
}

/**
 * Create a new webhook workflow in N8N
 */
export async function createN8nWorkflow(template: WebhookWorkflowTemplate): Promise<N8nWorkflowResponse> {
  try {
    const workflow = await fetchAPI('/v1/n8n/workflows', {
      method: 'POST',
      body: JSON.stringify(template),
    });
    
    // Extract webhook URL from the workflow if available
    const webhookNode = workflow.nodes?.find((node: any) => 
      node.type === 'n8n-nodes-base.webhook'
    );
    
    let webhookUrl = '';
    if (webhookNode?.parameters?.webhookId || webhookNode?.webhookId) {
      const webhookId = webhookNode.parameters?.webhookId || webhookNode.webhookId;
      // Construct webhook URL - you may need to adjust this based on your N8N setup
      webhookUrl = `${process.env.NEXT_PUBLIC_N8N_WEBHOOK_BASE_URL || 'http://localhost:5678'}/webhook/${webhookId}`;
    }
    
    return {
      ...workflow,
      webhookUrl,
    };
  } catch (error) {
    console.error('Error creating N8N workflow:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to create N8N workflow');
  }
}

/**
 * Get all N8N workflows
 */
export async function getAllN8nWorkflows(): Promise<N8nWorkflowResponse[]> {
  try {
    const response = await fetchAPI('/v1/n8n/workflows');
    return response;
  } catch (error) {
    console.error('Error fetching N8N workflows:', error);
    throw new Error('Failed to fetch N8N workflows');
  }
}

/**
 * Get a specific N8N workflow by ID
 */
export async function getN8nWorkflow(id: string): Promise<N8nWorkflowResponse> {
  try {
    const response = await fetchAPI(`/v1/n8n/workflows/${id}`);
    return response;
  } catch (error) {
    console.error('Error fetching N8N workflow:', error);
    throw new Error('Failed to fetch N8N workflow');
  }
}

/**
 * Delete an N8N workflow by ID
 */
export async function deleteN8nWorkflow(id: string): Promise<void> {
  try {
    await fetchAPI(`/v1/n8n/workflows/${id}`, {
      method: 'DELETE',
    });
  } catch (error) {
    console.error('Error deleting N8N workflow:', error);
    throw new Error('Failed to delete N8N workflow');
  }
}

/**
 * Activate an N8N workflow
 */
export async function activateN8nWorkflow(id: string): Promise<N8nWorkflowResponse> {
  try {
    const response = await fetchAPI(`/v1/n8n/workflows/${id}/activate`, {
      method: 'POST',
    });
    return response;
  } catch (error) {
    console.error('Error activating N8N workflow:', error);
    throw new Error('Failed to activate N8N workflow');
  }
}

/**
 * Deactivate an N8N workflow
 */
export async function deactivateN8nWorkflow(id: string): Promise<N8nWorkflowResponse> {
  try {
    const response = await fetchAPI(`/v1/n8n/workflows/${id}/deactivate`, {
      method: 'POST',
    });
    return response;
  } catch (error) {
    console.error('Error deactivating N8N workflow:', error);
    throw new Error('Failed to deactivate N8N workflow');
  }
}

/**
 * Update the AI agent prompt in a workflow
 */
export async function updateN8nWorkflowPrompt(id: string, prompt: string): Promise<N8nWorkflowResponse> {
  try {
    const response = await fetchAPI(`/v1/n8n/workflows/${id}/agent-prompt`, {
      method: 'PUT',
      body: JSON.stringify({ prompt }),
    });
    return response;
  } catch (error) {
    console.error('Error updating N8N workflow prompt:', error);
    throw new Error('Failed to update N8N workflow prompt');
  }
}

/**
 * Extract webhook URL or Chat Trigger ID from workflow data
 * Returns an object with the webhook URL and/or trigger reference based on available nodes
 */
export function extractWebhookInfo(workflow: N8nWorkflowResponse): { webhookUrl: string; triggerRef: string; hasChatTrigger: boolean } {
  // Default empty result
  const result = {
    webhookUrl: '',
    triggerRef: '',
    hasChatTrigger: false
  };
  
  // Look for webhook node first (legacy support)
  const webhookNode = workflow.nodes?.find((node: any) => 
    node.type === 'n8n-nodes-base.webhook'
  );
  
  if (webhookNode?.parameters?.webhookId || webhookNode?.webhookId) {
    const webhookId = webhookNode.parameters?.webhookId || webhookNode.webhookId;
    result.webhookUrl = `${process.env.NEXT_PUBLIC_N8N_WEBHOOK_BASE_URL || 'http://localhost:5678'}/webhook/${webhookId}`;
  }
  
  // Look for Chat Trigger node
  const chatTriggerNode = workflow.nodes?.find((node: any) => 
    node.type === '@n8n/n8n-nodes-langchain.chatTrigger'
  );
  
  if (chatTriggerNode?.webhookId) {
    result.triggerRef = chatTriggerNode.webhookId;
    result.hasChatTrigger = true;
  }
  
  return result;
}

/**
 * Extract webhook URL from workflow data (legacy support)
 * @deprecated Use extractWebhookInfo instead
 */
export function extractWebhookUrl(workflow: N8nWorkflowResponse): string {
  const { webhookUrl } = extractWebhookInfo(workflow);
  return webhookUrl;
}

/**
 * Test a webhook by sending a sample request
 * Uses backend proxy to avoid CORS issues
 * @param webhookUrl The webhook URL to test
 * @param workflowId The ID of the workflow (to auto-activate if needed)
 * @param testData Additional data to include in the payload
 * @param headers Custom headers to send with the request
 */
export async function testN8nWebhook(
  webhookUrl: string, 
  workflowId: string, 
  testData: any = {}, 
  headers?: Record<string, string>
) {
  try {
    // Call backend endpoint instead of directly accessing the webhook URL
    const response = await fetchAPI('/v1/n8n/test-webhook', {
      method: 'POST',
      body: JSON.stringify({
        webhookUrl,
        workflowId,
        testData: {
          sessionId: `test-session-${Date.now()}`,
          message: 'Hi there, i need to schedule my appointment. also what was my previous appointment?',
          systemPrompt: 'You are riley, a helpful assistant to help with scheduling.',
          ...testData,
        },
        headers
      }),
    });
    
    return response;
  } catch (error) {
    console.error('Error testing N8N webhook:', error);
    throw new Error('Failed to test N8N webhook');
  }
}