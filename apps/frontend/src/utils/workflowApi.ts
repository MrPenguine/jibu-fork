import { FlowNode, FlowEdge, WorkflowDefinition, WorkflowSessionOutput } from '../../../../libs/src';
import { createClient } from './supabase/client';
import { getActiveOrgId } from './fileApi';

// Base URL for API requests
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

// Get the current organization ID
function getCurrentOrganizationId(specificOrgId?: string): string | null {
  // Prioritize the specificOrgId if provided
  if (specificOrgId) {
    return specificOrgId;
  }
  
  // Try to get organization ID from local storage or other sources
  const orgId = getActiveOrgId();
  
  if (!orgId) {
    console.warn('[workflowApi] No organization ID available');
  }
  
  return orgId;
}

// Get authorization headers with token and organization ID
async function getAuthHeaders(orgId: string) {
  const supabase = createClient();
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  
  if (!token) {
    throw new Error('No authentication token available');
  }
  
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'X-Organization-ID': orgId,
    'organization-id': orgId
  };
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

// Workflow API client
export const workflowApi = {
  // Fetch all workflows
  async getWorkflows(specificOrgId?: string): Promise<WorkflowDefinition[]> {
    try {
      const orgId = getCurrentOrganizationId(specificOrgId);
      
      if (!orgId) {
        throw new Error('No organization ID available');
      }
      
      const headers = await getAuthHeaders(orgId);
      
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
  async getWorkflowsByAssistant(assistantId: string, specificOrgId?: string): Promise<WorkflowDefinition[]> {
    try {
      const orgId = getCurrentOrganizationId(specificOrgId);
      
      if (!orgId) {
        throw new Error('No organization ID available');
      }
      
      const headers = await getAuthHeaders(orgId);
      
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
  async getWorkflow(workflowId: string, specificOrgId?: string): Promise<WorkflowDefinition> {
    try {
      const orgId = getCurrentOrganizationId(specificOrgId);
      
      if (!orgId) {
        throw new Error('No organization ID available');
      }
      
      const headers = await getAuthHeaders(orgId);
      
      const response = await fetch(`${API_BASE_URL}/v1/workflows/${workflowId}`, {
        method: 'GET',
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch workflow: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('[workflowApi] Error fetching workflow:', error);
      throw error;
    }
  },

  // Create a new workflow
  async createWorkflow(data: CreateWorkflowRequest, specificOrgId?: string): Promise<WorkflowDefinition> {
    try {
      const orgId = getCurrentOrganizationId(specificOrgId);
      
      if (!orgId) {
        console.error('[workflowApi] Organization ID is missing when creating workflow');
        throw new Error('No organization ID available. Please select an organization first.');
      }
      
      console.log('[workflowApi] Creating workflow with organization ID:', orgId);
      const headers = await getAuthHeaders(orgId);
      
      // Log the request data for debugging
      console.log('[workflowApi] Workflow creation payload:', {
        ...data,
        organizationId: orgId
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

  // Update an existing workflow
  async updateWorkflow(workflowId: string, data: UpdateWorkflowRequest, specificOrgId?: string): Promise<WorkflowDefinition> {
    try {
      const orgId = getCurrentOrganizationId(specificOrgId);
      
      if (!orgId) {
        throw new Error('No organization ID available');
      }
      
      const headers = await getAuthHeaders(orgId);
      
      const response = await fetch(`${API_BASE_URL}/v1/workflows/${workflowId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update workflow: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('[workflowApi] Error updating workflow:', error);
      throw error;
    }
  },

  // Delete a workflow
  async deleteWorkflow(workflowId: string, specificOrgId?: string): Promise<void> {
    try {
      const orgId = getCurrentOrganizationId(specificOrgId);
      
      if (!orgId) {
        throw new Error('No organization ID available');
      }
      
      const headers = await getAuthHeaders(orgId);
      
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
  async publishWorkflow(workflowId: string, specificOrgId?: string): Promise<WorkflowDefinition> {
    try {
      const orgId = getCurrentOrganizationId(specificOrgId);
      
      if (!orgId) {
        throw new Error('No organization ID available');
      }
      
      const headers = await getAuthHeaders(orgId);
      
      const response = await fetch(`${API_BASE_URL}/v1/workflows/${workflowId}/publish`, {
        method: 'POST',
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
  async unpublishWorkflow(workflowId: string, specificOrgId?: string): Promise<WorkflowDefinition> {
    try {
      const orgId = getCurrentOrganizationId(specificOrgId);
      
      if (!orgId) {
        throw new Error('No organization ID available');
      }
      
      const headers = await getAuthHeaders(orgId);
      
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
  async executeWorkflow(workflowId: string, data: ExecuteWorkflowRequest, specificOrgId?: string): Promise<WorkflowSessionOutput> {
    try {
      const orgId = getCurrentOrganizationId(specificOrgId);
      
      if (!orgId) {
        throw new Error('No organization ID available');
      }
      
      const headers = await getAuthHeaders(orgId);
      
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
  async continueWorkflowSession(sessionId: string, data: ContinueWorkflowRequest, specificOrgId?: string): Promise<WorkflowSessionOutput> {
    try {
      const orgId = getCurrentOrganizationId(specificOrgId);
      
      if (!orgId) {
        throw new Error('No organization ID available');
      }
      
      const headers = await getAuthHeaders(orgId);
      
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
