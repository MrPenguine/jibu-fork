import { fetchAPI, API_BASE_URL } from './api';
import { FlowNode, FlowEdge, AgentDefinition, AgentSessionOutput } from '../../../../libs/src';
import { createClient } from './supabase/client';
import { getActiveWorkspaceId } from './fileApi';

// Use shared API_BASE_URL from utils/api for consistent base path handling

/**
 * Utility for making requests to the Agent API
 */

export interface AgentRequestConfig {
  assistantId: string;
  clientId?: string;
  knowledgeBaseId?: string;
  stream?: boolean;
}

export interface AgentRequest {
  input: string;
  inputType?: string;
  outputType?: string;
  sessionId?: string;
  config?: AgentRequestConfig;
}

export interface AgentResponse {
  output: string;
  sessionId: string;
  metadata?: Record<string, any>;
}

/**
 * Extract text message from complex agent response
 */
export function extractMessageFromResponse(response: any): string {
  // If response is already a string, return it
  if (typeof response === 'string') {
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(response);
      
      // Check for nested output formats
      if (parsed.outputs && Array.isArray(parsed.outputs) && parsed.outputs.length > 0) {
        const firstOutput = parsed.outputs[0];
        
        // Use a recursive path traversal to find text content
        const findTextContent = (obj: any, maxDepth = 3, currentDepth = 0): string | null => {
          if (currentDepth > maxDepth || !obj || typeof obj !== 'object') return null;
          
          // Check common text content fields
          if (obj.text && typeof obj.text === 'string') return obj.text;
          if (obj.content && typeof obj.content === 'string') return obj.content;
          if (obj.message && typeof obj.message === 'string') return obj.message;
          if (obj.answer && typeof obj.answer === 'string') return obj.answer;
          
          // Recursively check nested objects and arrays
          for (const key in obj) {
            const result = findTextContent(obj[key], maxDepth, currentDepth + 1);
            if (result) return result;
          }
          
          return null;
        };
        
        const textContent = findTextContent(firstOutput);
        if (textContent) return textContent;
      }
      
      // Check for direct message property
      if (parsed.message) {
        return parsed.message;
      }
      
      if (parsed.output && typeof parsed.output === 'string') {
        // Try recursively parsing the output
        return extractMessageFromResponse(parsed.output);
      }
      
      // Fallback to original string
      return response;
    } catch (e) {
      // Not JSON, just return the string
      return response;
    }
  }
  
  // Handle object responses
  if (response && typeof response === 'object') {
    // Check different possible paths for the message
    if (response.text) return response.text;
    if (response.content) return response.content;
    if (response.message && typeof response.message === 'string') return response.message;
    if (response.output && typeof response.output === 'string') {
      return extractMessageFromResponse(response.output);
    }
    
    // Last resort - stringify but warn about it
    console.warn('Could not extract message from object response:', response);
    return JSON.stringify(response);
  }
  
  return String(response);
}

/**
 * Check the health of the agent service
 */
export async function checkAgentHealth(): Promise<{ status: string; connected: boolean }> {
  try {
    // Use fetchAPI instead of direct fetch
    return await fetchAPI('/v1/agent/health', {
      method: 'POST'
    });
  } catch (error) {
    console.error('Error checking agent health:', error);
    return { status: 'error', connected: false };
  }
}

/**
 * Send a request to the agent API
 */
export async function sendAgentRequest(
  request: AgentRequest
): Promise<AgentResponse> {
  // Use fetchAPI instead of direct fetch
  return await fetchAPI('/v1/agent/query', {
    method: 'POST',
    body: JSON.stringify(request)
  });
}

/**
 * Callbacks for streaming agent responses
 */
export interface StreamCallbacks {
  onStart?: () => void;
  onToken?: (token: string, eventData: any) => void;
  onComplete?: (fullResponse: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Options for streaming requests
 */
export interface StreamOptions extends StreamCallbacks {
  headers?: Record<string, string>;
}

/**
 * Send a streaming request to the agent API
 * Returns a fetch response that can be used with a streaming reader
 */
export async function sendStreamingAgentRequest(
  request: AgentRequest,
  options?: StreamOptions
): Promise<Response | void> {
  try {
    if (options?.onStart) {
      options.onStart();
    }
    
    // Use fetchAPI for authentication but still need direct fetch for streaming
    // Get auth headers from fetchAPI's internal implementation
    const supabase = await import('./supabase/client').then(m => m.createClient());
    const { data: { session } } = await supabase.auth.getSession();
    const activeWorkspaceId = await import('./fileApi').then(m => m.getActiveWorkspaceId());
    
    if (!session?.access_token) {
      throw new Error('No active session. User must be authenticated to make this request.');
    }
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      ...(activeWorkspaceId ? { 'X-Workspace-ID': activeWorkspaceId, 'workspace-id': activeWorkspaceId } : {}),
      ...(options?.headers || {})
    };
    
    // Get the API base URL from the api.ts module
    const { API_BASE_URL } = await import('./api');
    const url = `${API_BASE_URL}/v1/agents/stream`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(`Server responded with ${response.status}: ${errorText}`);
      if (options?.onError) {
        options.onError(error);
      }
      return response; // Still return the response for backward compatibility
    }
    
    // Check if we have a streaming response
    if (!response.body) {
      const error = new Error('No response body from server');
      if (options?.onError) {
        options.onError(error);
      }
      return response;
    }
    
    // If we have callbacks, process the stream
    if (options) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      
      // Process the stream
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          // Decode the chunk and split by double newlines (SSE format)
          const chunk = decoder.decode(value, { stream: true });
          
          const lines = chunk.split('\n\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const eventData = JSON.parse(line.substring(6));
                
                // Handle error responses
                if (eventData.error) {
                  throw new Error(eventData.message || 'Unknown error');
                }
                
                // Only process output if it's not empty and it's not a duplicate of the first message
                if (eventData.output) {
                  // Check if this is a duplicate of the first message (common greeting pattern)
                  const isFirstMessageDuplicate = fullResponse && 
                    eventData.output.includes("Thank you for calling Wellness Partners") && 
                    eventData.output.includes("How may I help you today?");
                  
                  // Only process if it's not a duplicate greeting
                  if (!isFirstMessageDuplicate) {
                    // Call the onToken callback
                    if (options.onToken) {
                      options.onToken(eventData.output, eventData);
                    }
                    
                    // Update the full response with non-empty content
                    fullResponse = eventData.output;
                  }
                }
                
                // If this is the final response with metadata, call onComplete
                if (eventData.metadata?.type === 'final' && options.onComplete) {
                  options.onComplete(fullResponse);
                }
              } catch (error) {
                console.error('Error parsing SSE message:', error);
                if (options.onError) {
                  options.onError(error instanceof Error ? error : new Error(String(error)));
                }
              }
            }
          }
        }
        
        // onComplete is already called when we receive the final metadata
        // No need to call it again here
      } catch (error) {
        console.error('Error reading stream:', error);
        if (options.onError) {
          options.onError(error instanceof Error ? error : new Error(String(error)));
        }
      }
      
      return;
    }
    
    // If no callbacks, just return the response for manual handling
    return response;
  } catch (error) {
    console.error('Error sending streaming request:', error);
    if (options?.onError) {
      options.onError(error instanceof Error ? error : new Error(String(error)));
    }
  }
}

// Get the current workspace ID
function getCurrentWorkspaceId(specificWorkspaceId?: string): string | null {
  // Prioritize the specificWorkspaceId if provided
  if (specificWorkspaceId) {
    return specificWorkspaceId;
  }
  
  // Try to get workspace ID from local storage or other sources
  const workspaceId = getActiveWorkspaceId();
  
  if (!workspaceId) {
    console.warn('[agentApi] No workspace ID available');
  }
  
  return workspaceId;
}

// Get authorization headers with token and workspace ID
async function getAuthHeaders(workspaceId: string) {
  const supabase = createClient();
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  
  if (!token) {
    throw new Error('No authentication token available');
  }
  
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'X-Workspace-ID': workspaceId,
    'workspace-id': workspaceId
  };
}

// Interface for agent definition creation
interface CreateAgentDefinitionRequest {
  name: string;
  description?: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  startNodeId?: string;
  assistantId?: string;
  workspaceId: string;
}

// Interface for agent definition update
interface UpdateAgentDefinitionRequest {
  name?: string;
  description?: string;
  nodes?: FlowNode[] | string;
  edges?: FlowEdge[] | string;
  startNodeId?: string;
  assistantId?: string;
  isPublished?: boolean;
}

// Interface for agent execution
interface ExecuteAgentRequest {
  initialVariables?: Record<string, any>;
  chatId?: string;
  callSid?: string;
}

// Interface for continuing agent execution
interface ContinueAgentRequest {
  userInput?: string;
  event?: Record<string, any>;
}

// Interface for workflow data
export interface Workflow {
  id: string;
  name: string;
  description: string;
  trigger?: string;
  status?: string;
  assignee?: string;
  updatedAt: string;
  workflowType: 'MASTER' | 'SECONDARY';
  masterAgentId?: string;
  nodes?: any[];
  edges?: any[];
}

// Interface for creating secondary workflow
export interface CreateSecondaryWorkflowRequest {
  name: string;
  description?: string;
  nodes?: any;
  edges?: any;
  startNodeId?: string;
}

// Agent API client functions
export const agentApiClient = {
  // Fetch all agent definitions
  async getAgentDefinitions(specificWorkspaceId?: string): Promise<AgentDefinition[]> {
    try {
      const workspaceId = getCurrentWorkspaceId(specificWorkspaceId);
      
      if (!workspaceId) {
        throw new Error('No workspace ID available');
      }
      
      const headers = await getAuthHeaders(workspaceId);
      
      const response = await fetch(`${API_BASE_URL}/v1/agents`, {
        method: 'GET',
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch agent definitions: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('[agentApi] Error fetching agent definitions:', error);
      throw error;
    }
  },

  // Fetch agent definitions for a specific assistant
  async getAgentDefinitionsByAssistant(assistantId: string, specificWorkspaceId?: string): Promise<AgentDefinition[]> {
    try {
      const workspaceId = getCurrentWorkspaceId(specificWorkspaceId);
      
      if (!workspaceId) {
        throw new Error('No workspace ID available');
      }
      
      const headers = await getAuthHeaders(workspaceId);
      
      const response = await fetch(`${API_BASE_URL}/v1/agents/assistant/${assistantId}`, {
        method: 'GET',
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch agent definitions for assistant: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('[agentApi] Error fetching agent definitions for assistant:', error);
      throw error;
    }
  },

  // Fetch a specific agent definition by ID
  async getAgentDefinition(agentId: string, specificWorkspaceId?: string): Promise<AgentDefinition> {
    try {
      const workspaceId = getCurrentWorkspaceId(specificWorkspaceId);
      
      if (!workspaceId) {
        throw new Error('No workspace ID available');
      }
      
      const headers = await getAuthHeaders(workspaceId);
      
      const response = await fetch(`${API_BASE_URL}/v1/agents/${agentId}`, {
        method: 'GET',
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch agent definition: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('[agentApi] Error fetching agent definition:', error);
      throw error;
    }
  },

  // Create a new agent definition
  async createAgentDefinition(data: CreateAgentDefinitionRequest, specificWorkspaceId?: string): Promise<AgentDefinition> {
    try {
      const workspaceId = getCurrentWorkspaceId(specificWorkspaceId);
      
      if (!workspaceId) {
        throw new Error('No workspace ID available');
      }

      data.workspaceId = workspaceId;
      
      const headers = await getAuthHeaders(workspaceId);
      
      // Ensure nodes and edges are serialized if they are arrays
      const requestData = {
        ...data,
        nodes: Array.isArray(data.nodes) ? data.nodes : JSON.parse(data.nodes as unknown as string),
        edges: Array.isArray(data.edges) ? data.edges : JSON.parse(data.edges as unknown as string)
      };
      
      const response = await fetch(`${API_BASE_URL}/v1/agents`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestData),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create agent definition: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('[agentApi] Error creating agent definition:', error);
      throw error;
    }
  },

  // Update an existing agent definition
  async updateAgentDefinition(agentId: string, data: UpdateAgentDefinitionRequest, specificWorkspaceId?: string): Promise<AgentDefinition> {
    try {
      const workspaceId = getCurrentWorkspaceId(specificWorkspaceId);
      
      if (!workspaceId) {
        throw new Error('No workspace ID available');
      }
      
      const headers = await getAuthHeaders(workspaceId);
      
      const response = await fetch(`${API_BASE_URL}/v1/agents/${agentId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update agent definition: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('[agentApi] Error updating agent definition:', error);
      throw error;
    }
  },

  // Delete an agent definition
  async deleteAgentDefinition(agentId: string, specificWorkspaceId?: string): Promise<void> {
    try {
      const workspaceId = getCurrentWorkspaceId(specificWorkspaceId);
      
      if (!workspaceId) {
        throw new Error('No workspace ID available');
      }
      
      const headers = await getAuthHeaders(workspaceId);
      // Some controllers also accept/require workspaceId via query param. Include it for compatibility.
      const url = `${API_BASE_URL}/v1/agents/${agentId}?workspaceId=${encodeURIComponent(workspaceId)}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Failed to delete agent definition: ${response.status} ${response.statusText}. ${errorText}`);
      }
    } catch (error) {
      console.error('[agentApi] Error deleting agent definition:', error);
      throw error;
    }
  },

  // Publish an agent definition
  async publishAgentDefinition(agentId: string, specificWorkspaceId?: string): Promise<AgentDefinition> {
    try {
      const workspaceId = getCurrentWorkspaceId(specificWorkspaceId);
      
      if (!workspaceId) {
        throw new Error('No workspace ID available');
      }
      
      const headers = await getAuthHeaders(workspaceId);
      
      const response = await fetch(`${API_BASE_URL}/v1/agents/${agentId}/publish`, {
        method: 'POST',
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Failed to publish agent definition: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('[agentApi] Error publishing agent definition:', error);
      throw error;
    }
  },

  // Unpublish an agent definition
  async unpublishAgentDefinition(agentId: string, specificWorkspaceId?: string): Promise<AgentDefinition> {
    try {
      const workspaceId = getCurrentWorkspaceId(specificWorkspaceId);
      
      if (!workspaceId) {
        throw new Error('No workspace ID available');
      }
      
      const headers = await getAuthHeaders(workspaceId);
      
      const response = await fetch(`${API_BASE_URL}/v1/agents/${agentId}/unpublish`, {
        method: 'POST',
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Failed to unpublish agent definition: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('[agentApi] Error unpublishing agent definition:', error);
      throw error;
    }
  },

  // Execute an agent
  async executeAgent(agentId: string, data: ExecuteAgentRequest, specificWorkspaceId?: string): Promise<AgentSessionOutput> {
    try {
      const workspaceId = getCurrentWorkspaceId(specificWorkspaceId);
      
      if (!workspaceId) {
        throw new Error('No workspace ID available');
      }
      
      const headers = await getAuthHeaders(workspaceId);
      
      const response = await fetch(`${API_BASE_URL}/v1/agent-execution/agents/${agentId}/execute`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to execute agent: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('[agentApi] Error executing agent:', error);
      throw error;
    }
  },

  // Continue an agent session
  async continueAgentSession(sessionId: string, data: ContinueAgentRequest, specificWorkspaceId?: string): Promise<AgentSessionOutput> {
    try {
      const workspaceId = getCurrentWorkspaceId(specificWorkspaceId);
      
      if (!workspaceId) {
        throw new Error('No workspace ID available');
      }
      
      const headers = await getAuthHeaders(workspaceId);
      
      const response = await fetch(`${API_BASE_URL}/v1/agent-execution/sessions/${sessionId}/continue`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to continue agent session: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('[agentApi] Error continuing agent session:', error);
      throw error;
    }
  },

  // Get an agent definition by ID
  async getAgent(agentId: string, specificWorkspaceId?: string): Promise<AgentDefinition> {
    try {
      const workspaceId = getCurrentWorkspaceId(specificWorkspaceId);
      
      if (!workspaceId) {
        throw new Error('No workspace ID available');
      }
      
      const headers = await getAuthHeaders(workspaceId);
      
      const response = await fetch(`${API_BASE_URL}/v1/agents/${agentId}`, {
        method: 'GET',
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch agent: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('[agentApi] Error fetching agent:', error);
      throw error;
    }
  },

  // Get all workflows for an agent
  async getAgentWorkflows(agentId: string, specificWorkspaceId?: string): Promise<Workflow[]> {
    try {
      const workspaceId = getCurrentWorkspaceId(specificWorkspaceId);
      
      if (!workspaceId) {
        throw new Error('No workspace ID available');
      }
      
      const headers = await getAuthHeaders(workspaceId);
      
      const response = await fetch(`${API_BASE_URL}/v1/agents/${agentId}/workflows`, {
        method: 'GET',
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch agent workflows: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('[agentApi] Error fetching agent workflows:', error);
      throw error;
    }
  },

  // Create a secondary workflow for an agent
  async createSecondaryWorkflow(masterWorkflowId: string, data: CreateSecondaryWorkflowRequest, specificWorkspaceId?: string): Promise<Workflow> {
    try {
      const workspaceId = getCurrentWorkspaceId(specificWorkspaceId);
      
      if (!workspaceId) {
        throw new Error('No workspace ID available');
      }
      
      const headers = await getAuthHeaders(workspaceId);
      
      // Using the correct endpoint URL that matches the backend controller
      const response = await fetch(`${API_BASE_URL}/v1/workflows/${masterWorkflowId}/secondary`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create secondary workflow: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('[agentApi] Error creating secondary workflow:', error);
      throw error;
    }
  },

  // Publish an agent
  async publishAgent(agentId: string, specificWorkspaceId?: string): Promise<AgentDefinition> {
    try {
      const workspaceId = getCurrentWorkspaceId(specificWorkspaceId);
      
      if (!workspaceId) {
        throw new Error('No workspace ID available');
      }
      
      const headers = await getAuthHeaders(workspaceId);
      
      const response = await fetch(`${API_BASE_URL}/v1/agents/${agentId}/publish`, {
        method: 'POST',
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Failed to publish agent: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('[agentApi] Error publishing agent:', error);
      throw error;
    }
  },

  // Unpublish an agent
  async unpublishAgent(agentId: string, specificWorkspaceId?: string): Promise<AgentDefinition> {
    try {
      const workspaceId = getCurrentWorkspaceId(specificWorkspaceId);
      
      if (!workspaceId) {
        throw new Error('No workspace ID available');
      }
      
      const headers = await getAuthHeaders(workspaceId);
      
      const response = await fetch(`${API_BASE_URL}/v1/agents/${agentId}/unpublish`, {
        method: 'POST',
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Failed to unpublish agent: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('[agentApi] Error unpublishing agent:', error);
      throw error;
    }
  }
};
