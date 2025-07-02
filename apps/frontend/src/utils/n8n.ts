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
    const result = await fetchAPI('/v1/n8n/workflows', {
      method: 'POST',
      body: JSON.stringify(template),
    });
    
    // Handle the nested response structure from backend
    // Backend returns: { workflow, webhookUrl, webhookId }
    if (result.workflow) {
      // Return the nested structure as-is for the frontend to handle
      return result;
    }
    
    // Fallback for direct workflow response (legacy support)
    const workflow = result;
    const webhookNode = workflow.nodes?.find((node: any) => 
      node.type === 'n8n-nodes-base.webhook'
    );
    
    let webhookUrl = '';
    if (webhookNode?.parameters?.webhookId || webhookNode?.webhookId) {
      const webhookId = webhookNode.parameters?.webhookId || webhookNode.webhookId;
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
export async function getN8nWorkflow(id: string): Promise<N8nWorkflowResponse | null> {
  try {
    const response = await fetchAPI(`/v1/n8n/workflows/${id}`);
    return response;
  } catch (error) {
    console.error('Error fetching N8N workflow:', error);
    
    // If it's a 404 error (workflow not found), return null instead of throwing
    if (error instanceof Error && (error.message.includes('404') || error.message.includes('not found'))) {
      return null;
    }
    
    // For other errors, still throw
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
 * First fetches the latest workflow data to ensure it's active and get the correct webhook URL
 * @param webhookUrl The webhook URL to test (will be refreshed from latest workflow data)
 * @param workflowId The ID of the workflow
 * @param testData Additional data to include in the payload
 * @param headers Custom headers to send with the request
 */
export async function testN8nWebhook(
  webhookUrl: string, 
  workflowId: string, 
  testData: any = {}, 
  headers?: Record<string, string>
) {
  console.log('Testing webhook - Initial parameters:', { webhookUrl, workflowId });
  
  let latestWebhookUrl = webhookUrl;
  let useWorkflowData = false;
  
  try {
    // Attempt to fetch the latest workflow data
    console.log('Attempting to fetch workflow data for ID:', workflowId);
    
    try {
      const workflow = await getN8nWorkflow(workflowId);
      console.log('Workflow data fetch result:', workflow ? 'Found' : 'Not found');
      
      if (workflow) {
        console.log('Workflow active status:', workflow.active);
        useWorkflowData = true;
        
        if (!workflow.active) {
          console.warn('Warning: Workflow is not active, but continuing with test');
        }
        
        // Extract the latest webhook URL if possible
        const extractedUrl = extractWebhookUrl(workflow);
        if (extractedUrl) {
          latestWebhookUrl = extractedUrl;
          console.log('Using extracted webhook URL:', latestWebhookUrl);
        } else {
          console.log('No webhook URL found in workflow, using provided URL:', webhookUrl);
        }
      } else {
        console.warn('Warning: Workflow not found, but continuing with provided webhook URL');
      }
    } catch (fetchError) {
      console.error('Error fetching workflow:', fetchError);
      console.warn('Continuing with provided webhook URL despite fetch error');
    }
    
    // Always attempt to make the test request, even if workflow fetch fails
    console.log('Making webhook test request to backend with URL:', latestWebhookUrl);
    
    // Call backend endpoint instead of directly accessing the webhook URL
    const response = await fetchAPI('/v1/n8n/test-webhook', {
      method: 'POST',
      body: JSON.stringify({
        webhookUrl: latestWebhookUrl,
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
    
    console.log('Webhook test response received:', response);
    return response;
  } catch (error) {
    console.error('Error testing N8N webhook:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to test N8N webhook');
  }
}

/**
 * Calls the backend to poll and finalize the webhook setup for a given workflow.
 * This ensures the webhook is fully registered and ready before allowing tests.
 * @param workflowId The ID of the workflow to finalize.
 */
export async function finalizeN8nWebhookSetup(workflowId: string): Promise<{ status: string; message: string }> {
  try {
    const response = await fetchAPI(`/v1/n8n/workflows/${workflowId}/finalize-setup`, {
      method: 'POST',
    });
    return response;
  } catch (error) {
    console.error('Error finalizing N8N webhook setup:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to finalize N8N webhook setup');
  }
}