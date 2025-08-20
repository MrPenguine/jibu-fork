import { agentApiClient } from './AgentApi';
import * as n8nUtils from './n8n';

/**
 * Fetches the N8N webhook URL for an agent by getting its workflows
 * and extracting the webhook URL from the primary workflow
 * 
 * @param agentId The ID of the agent to get the webhook URL for
 * @param workspaceId Optional workspace ID (will use active workspace if not provided)
 * @returns Promise resolving to the webhook URL or null if not found
 */
export async function getAgentWebhookUrl(agentId: string, workspaceId?: string): Promise<string | null> {
  try {
    // Fetch the agent's workflows
    const workflows = await agentApiClient.getAgentWorkflows(agentId, workspaceId);
    
    if (!workflows || workflows.length === 0) {
      console.warn('No workflows found for agent', agentId);
      return null;
    }

    // Try to find a workflow with an N8N workflow ID
    for (const workflow of workflows) {
      // Check if the workflow has N8N metadata
      const n8nWorkflowId = workflow.trigger === 'n8n' ? workflow.id : null;
      
      if (n8nWorkflowId) {
        try {
          // Fetch the N8N workflow details to get the webhook URL
          const n8nWorkflow = await n8nUtils.getN8nWorkflow(n8nWorkflowId);
          
          if (n8nWorkflow) {
            // Extract the webhook URL using the utility function
            const webhookUrl = n8nUtils.extractWebhookUrl(n8nWorkflow);
            
            if (webhookUrl) {
              console.log(`Found webhook URL for agent ${agentId}:`, webhookUrl);
              return webhookUrl;
            }
          }
        } catch (error) {
          console.error('Error fetching N8N workflow details:', error);
        }
      }
    }
    
    console.warn('No webhook URL found in any of the agent workflows');
    return null;
  } catch (error) {
    console.error('Error fetching agent webhook URL:', error);
    return null;
  }
}

/**
 * Send a message to an agent's webhook and process the streaming response
 * 
 * @param webhookUrl The webhook URL to send the message to
 * @param message The message to send
 * @param sessionId The session/chat ID for context
 * @param callbacks Callbacks for handling the streaming response
 */
export async function sendStreamingWebhookMessage(
  webhookUrl: string,
  message: string,
  sessionId: string,
  callbacks: {
    onStart?: () => void;
    onToken?: (token: string, data?: any) => void;
    onError?: (error: Error) => void;
    onComplete?: () => void;
  },
  additionalParams: {
    systemPrompt?: string;
    contextLength?: number;
    workflowId?: string;
  } = {}
) {
  try {
    // Call the streaming webhook endpoint
    const response = await fetch('/api/v1/n8n/stream-webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        webhookUrl,
        message,
        sessionId,
        systemPrompt: additionalParams.systemPrompt,
        contextLength: additionalParams.contextLength || 5,
        workflowId: additionalParams.workflowId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Webhook streaming request failed: ${response.status} ${errorText}`);
    }

    // Setup SSE event source for streaming
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    
    if (callbacks.onStart) {
      callbacks.onStart();
    }

    // Process the stream
    let responseText = '';
    let lastChunk = '';

    async function readStream() {
      try {
        const { done, value } = await reader.read();
        
        if (done) {
          if (callbacks.onComplete) {
            callbacks.onComplete();
          }
          return;
        }

        // Decode the chunk and process
        const chunk = decoder.decode(value, { stream: true });
        lastChunk += chunk;
        
        // Split by SSE data: format and process each event
        const events = lastChunk.split('\n\n');
        
        // The last element might be incomplete, keep it for the next chunk
        lastChunk = events.pop() || '';

        for (const event of events) {
          if (event.startsWith('data: ')) {
            try {
              const data = JSON.parse(event.slice(6));
              
              // Handle error in response
              if (data.error) {
                if (callbacks.onError) {
                  callbacks.onError(new Error(data.error));
                }
                return;
              }
              
              // Handle completion marker
              if (data.done) {
                if (callbacks.onComplete) {
                  callbacks.onComplete();
                }
                return;
              }
              
              // Extract token from chunk data
              const token = data.text || data.content || data.chunk || data.token || data;
              
              if (token && callbacks.onToken) {
                callbacks.onToken(token, data);
                responseText += token;
              }
            } catch (err) {
              console.warn('Failed to parse SSE data:', event, err);
            }
          }
        }
        
        // Continue reading the stream
        await readStream();
      } catch (error) {
        if (callbacks.onError) {
          callbacks.onError(error as Error);
        }
      }
    }

    // Start reading the stream
    await readStream();
    
    return responseText;
  } catch (error) {
    console.error('Error in streaming webhook message:', error);
    if (callbacks.onError) {
      callbacks.onError(error as Error);
    }
    throw error;
  }
}
