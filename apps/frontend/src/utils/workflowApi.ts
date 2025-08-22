import { FlowNode, FlowEdge, WorkflowDefinition } from '../../../../libs/shadcn-ui/src/types';
import { AgentSessionOutput as WorkflowSessionOutput } from '../../../../libs/shadcn-ui/src/types';
import { createClient } from './supabase/client';
import { getActiveWorkspaceId } from './fileApi';

// Base URL for API requests
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

// Get the current workspace ID
function getCurrentWorkspaceId(specificWorkspaceId?: string): string | null {
  // Prioritize the specificWorkspaceId if provided
  if (specificWorkspaceId) {
    return specificWorkspaceId;
  }
  
  // Try to get workspace ID from local storage or other sources
  let workspaceId = getActiveWorkspaceId();
  
  if (!workspaceId) {
    console.warn('[workflowApi] No workspace ID available');
  }
  
  return workspaceId;
}

// Get authorization headers with token and workspace ID
async function getAuthHeaders(workspaceId: string) {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  
  if (!token) {
    throw new Error('No authentication token available');
  }
  
  // Provide common header casings to satisfy different backends
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    // Common variants
    'X-Workspace-ID': workspaceId,
    'X-Workspace-Id': workspaceId,
    'x-workspace-id': workspaceId,
    'workspace-id': workspaceId,
  } as Record<string, string>;
}

// Interface for workflow creation
interface CreateWorkflowRequest {
  name: string;
  description?: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  startNodeId?: string;
  assistantId?: string;
}

// Interface for workflow update
interface UpdateWorkflowRequest {
  name?: string;
  description?: string;
  nodes?: FlowNode[] | string;
  edges?: FlowEdge[] | string;
  startNodeId?: string;
  assistantId?: string;
  isPublished?: boolean;
}

// Interface for workflow execution
interface ExecuteWorkflowRequest {
  initialVariables?: Record<string, any>;
  chatId?: string;
  callSid?: string;
}

// Interface for continuing workflow execution
interface ContinueWorkflowRequest {
  userInput?: string;
  event?: Record<string, any>;
}

// Interface for secondary workflow creation
interface CreateSecondaryWorkflowRequest {
  name: string;
  description?: string;
  nodes?: FlowNode[] | string;
  edges?: FlowEdge[] | string;
  startNodeId?: string;
}

// Workflow API client
export const workflowApi = {
  // Fetch all workflows
  async getWorkflows(specificWorkspaceId?: string): Promise<WorkflowDefinition[]> {
    try {
      const workspaceId = getCurrentWorkspaceId(specificWorkspaceId);
      
      if (!workspaceId) {
        throw new Error('No workspace ID available');
      }
      
      const headers = await getAuthHeaders(workspaceId);
      
      const response = await fetch(`${API_BASE_URL}/v1/workflows`, {
        method: 'GET',
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch workflows: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('[workflowApi] Error fetching workflows:', error);
      throw error;
    }
  },

  // Fetch workflows for a specific assistant
  async getWorkflowsByAssistant(assistantId: string, specificWorkspaceId?: string): Promise<WorkflowDefinition[]> {
    try {
      const workspaceId = getCurrentWorkspaceId(specificWorkspaceId);
      
      if (!workspaceId) {
        throw new Error('No workspace ID available');
      }
      
      const headers = await getAuthHeaders(workspaceId);
      
      const response = await fetch(`${API_BASE_URL}/v1/workflows/assistant/${assistantId}`, {
        method: 'GET',
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch workflows for assistant: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('[workflowApi] Error fetching workflows for assistant:', error);
      throw error;
    }
  },

  // Fetch a specific workflow by ID
  async getWorkflow(workflowId: string, specificWorkspaceId?: string): Promise<WorkflowDefinition | null> {
    try {
      const workspaceId = getCurrentWorkspaceId(specificWorkspaceId);
      
      if (!workspaceId) {
        throw new Error('No workspace ID available');
      }
      
      const headers = await getAuthHeaders(workspaceId);
      
      const response = await fetch(`${API_BASE_URL}/v1/workflows/${workflowId}`, {
        method: 'GET',
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch workflow: ${response.statusText}`);
      }
      // Some environments may return 204 or an empty body for a new/unknown workflow.
      const text = await response.text();
      if (!text || text.trim().length === 0) {
        console.warn('[workflowApi] getWorkflow received empty body');
        return null;
      }
      return JSON.parse(text);
    } catch (error) {
      console.error('[workflowApi] Error fetching workflow:', error);
      throw error;
    }
  },

  // Create a new workflow
  async createWorkflow(data: CreateWorkflowRequest, specificWorkspaceId?: string): Promise<WorkflowDefinition> {
    try {
      const workspaceId = getCurrentWorkspaceId(specificWorkspaceId);
      
      if (!workspaceId) {
        console.error('[workflowApi] Workspace ID is missing when creating workflow');
        throw new Error('No workspace ID available. Please select a workspace first.');
      }
      
      console.log('[workflowApi] Creating workflow with workspace ID:', workspaceId);
      const headers = await getAuthHeaders(workspaceId);
      
      // Log the request data for debugging
      console.log('[workflowApi] Workflow creation payload:', {
        ...data,
        workspaceId: workspaceId
      });
      
      const response = await fetch(`${API_BASE_URL}/v1/workflows`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        // Try to get more detailed error information
        const errorText = await response.text();
        console.error('[workflowApi] Server response error:', errorText);
        throw new Error(`Failed to create workflow: ${response.statusText}. ${errorText || ''}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('[workflowApi] Error creating workflow:', error);
      throw error;
    }
  },

  // Create a secondary workflow linked to a master workflow and agent
  async createSecondaryWorkflow(
    masterWorkflowId: string,
    agentId: string,
    data: CreateSecondaryWorkflowRequest,
    specificWorkspaceId?: string,
  ): Promise<WorkflowDefinition> {
    try {
      const workspaceId = getCurrentWorkspaceId(specificWorkspaceId);
      
      if (!workspaceId) {
        throw new Error('No workspace ID available');
      }
      
      const headers = await getAuthHeaders(workspaceId);
      const url = `${API_BASE_URL}/v1/workflows/${masterWorkflowId}/secondary?agentId=${encodeURIComponent(agentId)}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error('[workflowApi] Server response error (createSecondary):', errorText);
        throw new Error(`Failed to create secondary workflow: ${response.statusText}. ${errorText || ''}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('[workflowApi] Error creating secondary workflow:', error);
      throw error;
    }
  },

  // Update an existing workflow
  async updateWorkflow(workflowId: string, data: UpdateWorkflowRequest, specificWorkspaceId?: string): Promise<WorkflowDefinition> {
    try {
      const workspaceId = getCurrentWorkspaceId(specificWorkspaceId);
      
      if (!workspaceId) {
        throw new Error('No workspace ID available');
      }
      
      const headers = await getAuthHeaders(workspaceId);
      
      console.log(`[workflowApi] Updating workflow ${workflowId} with data:`, data);
      console.log(`[workflowApi] Using API URL: ${API_BASE_URL}/v1/workflows/${workflowId}?workspaceId=${workspaceId}`);
      
      const response = await fetch(`${API_BASE_URL}/v1/workflows/${workflowId}?workspaceId=${encodeURIComponent(workspaceId)}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          ...data,
          agentId: data.assistantId, // Pass agentId for upsert
          workspaceId,               // Include workspace in body as well
        }),
      });
      
      if (!response.ok) {
        // Try to get more detailed error information
        const errorText = await response.text().catch(() => 'No error details available');
        console.error(`[workflowApi] Server response error (${response.status}):`, errorText);
        throw new Error(`Failed to update workflow: ${response.statusText}. Details: ${errorText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('[workflowApi] Error updating workflow:', error);
      throw error;
    }
  },

  // Delete a workflow
  async deleteWorkflow(workflowId: string, specificWorkspaceId?: string): Promise<void> {
    try {
      const workspaceId = getCurrentWorkspaceId(specificWorkspaceId);
      
      if (!workspaceId) {
        throw new Error('No workspace ID available');
      }
      
      const headers = await getAuthHeaders(workspaceId);
      
      const response = await fetch(`${API_BASE_URL}/v1/workflows/${workflowId}`, {
        method: 'DELETE',
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete workflow: ${response.statusText}`);
      }
    } catch (error) {
      console.error('[workflowApi] Error deleting workflow:', error);
      throw error;
    }
  },

  // Publish a workflow
  async publishWorkflow(workflowId: string, specificWorkspaceId?: string): Promise<WorkflowDefinition> {
    try {
      const workspaceId = getCurrentWorkspaceId(specificWorkspaceId);
      
      if (!workspaceId) {
        throw new Error('No workspace ID available');
      }
      
      const headers = await getAuthHeaders(workspaceId);
      
      const response = await fetch(`${API_BASE_URL}/v1/workflows/${workflowId}/publish`, {
        method: 'PUT',
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Failed to publish workflow: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('[workflowApi] Error publishing workflow:', error);
      throw error;
    }
  },

  // Unpublish a workflow
  async unpublishWorkflow(workflowId: string, specificWorkspaceId?: string): Promise<WorkflowDefinition> {
    try {
      const workspaceId = getCurrentWorkspaceId(specificWorkspaceId);
      
      if (!workspaceId) {
        throw new Error('No workspace ID available');
      }
      
      const headers = await getAuthHeaders(workspaceId);
      
      const response = await fetch(`${API_BASE_URL}/v1/workflows/${workflowId}/unpublish`, {
        method: 'POST',
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Failed to unpublish workflow: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('[workflowApi] Error unpublishing workflow:', error);
      throw error;
    }
  },

  // Execute a workflow
  async executeWorkflow(workflowId: string, data: ExecuteWorkflowRequest, specificWorkspaceId?: string): Promise<WorkflowSessionOutput> {
    try {
      const workspaceId = getCurrentWorkspaceId(specificWorkspaceId);
      
      if (!workspaceId) {
        throw new Error('No workspace ID available');
      }
      
      const headers = await getAuthHeaders(workspaceId);
      
      const response = await fetch(`${API_BASE_URL}/v1/workflow-execution/workflows/${workflowId}/execute`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to execute workflow: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('[workflowApi] Error executing workflow:', error);
      throw error;
    }
  },

  // Continue a workflow session
  async continueWorkflowSession(sessionId: string, data: ContinueWorkflowRequest, specificWorkspaceId?: string): Promise<WorkflowSessionOutput> {
    try {
      const workspaceId = getCurrentWorkspaceId(specificWorkspaceId);
      
      if (!workspaceId) {
        throw new Error('No workspace ID available');
      }
      
      const headers = await getAuthHeaders(workspaceId);
      
      const response = await fetch(`${API_BASE_URL}/v1/workflow-execution/sessions/${sessionId}/continue`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to continue workflow session: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('[workflowApi] Error continuing workflow session:', error);
      throw error;
    }
  },
};
