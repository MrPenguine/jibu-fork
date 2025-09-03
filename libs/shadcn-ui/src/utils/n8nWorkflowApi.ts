import { getAuthHeaders } from './auth';

// Base URL for API requests
const API_BASE_URL = '/api/v1/n8n';

// Interface for n8n workflow
export interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  nodes: any[];
  connections: any;
  settings?: any;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

// Interface for workflow creation/update
export interface N8nWorkflowRequest {
  name: string;
  nodes: any[];
  connections: any;
  active?: boolean;
  settings?: any;
  tags?: string[];
}

// n8n Workflow API client
export const n8nWorkflowApi = {
  // Fetch all n8n workflows
  async getWorkflows(): Promise<N8nWorkflow[]> {
    try {
      const headers = await getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/workflows`, {
        method: 'GET',
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch n8n workflows: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('[n8nWorkflowApi] Error fetching workflows:', error);
      throw error;
    }
  },

  // Fetch a specific n8n workflow by ID
  async getWorkflow(workflowId: string): Promise<N8nWorkflow> {
    try {
      const headers = await getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/workflows/${workflowId}`, {
        method: 'GET',
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch n8n workflow: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('[n8nWorkflowApi] Error fetching workflow:', error);
      throw error;
    }
  },

  // Create a new n8n workflow
  async createWorkflow(data: N8nWorkflowRequest): Promise<N8nWorkflow> {
    try {
      const headers = await getAuthHeaders();
      
      console.log('[n8nWorkflowApi] Creating workflow with data:', data);
      
      const response = await fetch(`${API_BASE_URL}/workflows`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        // Try to get more detailed error information
        const errorText = await response.text().catch(() => 'No error details available');
        console.error('[n8nWorkflowApi] Server response error:', errorText);
        throw new Error(`Failed to create workflow: ${response.statusText}. ${errorText || ''}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('[n8nWorkflowApi] Error creating workflow:', error);
      throw error;
    }
  },

  // Update an existing n8n workflow
  async updateWorkflow(workflowId: string, data: Partial<N8nWorkflowRequest>): Promise<N8nWorkflow> {
    try {
      const headers = await getAuthHeaders();
      
      console.log(`[n8nWorkflowApi] Updating workflow ${workflowId} with data:`, data);
      
      const response = await fetch(`${API_BASE_URL}/workflows/${workflowId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        // Try to get more detailed error information
        const errorText = await response.text().catch(() => 'No error details available');
        console.error(`[n8nWorkflowApi] Server response error (${response.status}):`, errorText);
        throw new Error(`Failed to update workflow: ${response.statusText}. Details: ${errorText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('[n8nWorkflowApi] Error updating workflow:', error);
      throw error;
    }
  },

  // Delete an n8n workflow
  async deleteWorkflow(workflowId: string): Promise<void> {
    try {
      const headers = await getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/workflows/${workflowId}`, {
        method: 'DELETE',
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete workflow: ${response.statusText}`);
      }
    } catch (error) {
      console.error('[n8nWorkflowApi] Error deleting workflow:', error);
      throw error;
    }
  },

  // Activate an n8n workflow
  async activateWorkflow(workflowId: string): Promise<N8nWorkflow> {
    try {
      return this.updateWorkflow(workflowId, { active: true });
    } catch (error) {
      console.error('[n8nWorkflowApi] Error activating workflow:', error);
      throw error;
    }
  },

  // Deactivate an n8n workflow
  async deactivateWorkflow(workflowId: string): Promise<N8nWorkflow> {
    try {
      return this.updateWorkflow(workflowId, { active: false });
    } catch (error) {
      console.error('[n8nWorkflowApi] Error deactivating workflow:', error);
      throw error;
    }
  }
};
