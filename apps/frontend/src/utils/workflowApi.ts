import { FlowNode, FlowEdge, WorkflowDefinition, WorkflowSessionOutput } from '../../../../libs/src';

// Base URL for API requests
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

// Interface for workflow creation
interface CreateWorkflowRequest {
  name: string;
  description?: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  startNodeId?: string;
  assistantId: string;
}

// Interface for workflow update
interface UpdateWorkflowRequest {
  name?: string;
  description?: string;
  nodes?: FlowNode[];
  edges?: FlowEdge[];
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
  async getWorkflows(): Promise<WorkflowDefinition[]> {
    const response = await fetch(`${API_BASE_URL}/v1/workflows`);
    if (!response.ok) {
      throw new Error(`Failed to fetch workflows: ${response.statusText}`);
    }
    return response.json();
  },

  // Fetch workflows for a specific assistant
  async getWorkflowsByAssistant(assistantId: string): Promise<WorkflowDefinition[]> {
    const response = await fetch(`${API_BASE_URL}/v1/workflows/assistant/${assistantId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch workflows for assistant: ${response.statusText}`);
    }
    return response.json();
  },

  // Fetch a specific workflow by ID
  async getWorkflow(workflowId: string): Promise<WorkflowDefinition> {
    const response = await fetch(`${API_BASE_URL}/v1/workflows/${workflowId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch workflow: ${response.statusText}`);
    }
    return response.json();
  },

  // Create a new workflow
  async createWorkflow(data: CreateWorkflowRequest): Promise<WorkflowDefinition> {
    const response = await fetch(`${API_BASE_URL}/v1/workflows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`Failed to create workflow: ${response.statusText}`);
    }
    return response.json();
  },

  // Update an existing workflow
  async updateWorkflow(workflowId: string, data: UpdateWorkflowRequest): Promise<WorkflowDefinition> {
    const response = await fetch(`${API_BASE_URL}/v1/workflows/${workflowId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`Failed to update workflow: ${response.statusText}`);
    }
    return response.json();
  },

  // Delete a workflow
  async deleteWorkflow(workflowId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/v1/workflows/${workflowId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error(`Failed to delete workflow: ${response.statusText}`);
    }
  },

  // Publish a workflow
  async publishWorkflow(workflowId: string): Promise<WorkflowDefinition> {
    const response = await fetch(`${API_BASE_URL}/v1/workflows/${workflowId}/publish`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error(`Failed to publish workflow: ${response.statusText}`);
    }
    return response.json();
  },

  // Unpublish a workflow
  async unpublishWorkflow(workflowId: string): Promise<WorkflowDefinition> {
    const response = await fetch(`${API_BASE_URL}/v1/workflows/${workflowId}/unpublish`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error(`Failed to unpublish workflow: ${response.statusText}`);
    }
    return response.json();
  },

  // Execute a workflow
  async executeWorkflow(workflowId: string, data: ExecuteWorkflowRequest): Promise<WorkflowSessionOutput> {
    const response = await fetch(`${API_BASE_URL}/v1/workflow-execution/workflows/${workflowId}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`Failed to execute workflow: ${response.statusText}`);
    }
    return response.json();
  },

  // Continue a workflow session
  async continueWorkflowSession(sessionId: string, data: ContinueWorkflowRequest): Promise<WorkflowSessionOutput> {
    const response = await fetch(`${API_BASE_URL}/v1/workflow-execution/sessions/${sessionId}/continue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`Failed to continue workflow session: ${response.statusText}`);
    }
    return response.json();
  },
};
