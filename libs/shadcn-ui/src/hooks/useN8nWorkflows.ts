import { useState, useEffect } from 'react';
import { n8nWorkflowApi, N8nWorkflow, N8nWorkflowRequest } from '../utils/n8nWorkflowApi';

export function useN8nWorkflows() {
  const [workflows, setWorkflows] = useState<N8nWorkflow[] | null>(null);
  const [currentWorkflow, setCurrentWorkflow] = useState<N8nWorkflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch all workflows
  useEffect(() => {
    const fetchWorkflows = async () => {
      try {
        setLoading(true);
        const data = await n8nWorkflowApi.getWorkflows();
        setWorkflows(data);
      } catch (err) {
        console.error('Error fetching n8n workflows:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkflows();
  }, []);

  // Function to fetch a specific workflow
  const fetchWorkflow = async (workflowId: string) => {
    try {
      setLoading(true);
      const data = await n8nWorkflowApi.getWorkflow(workflowId);
      setCurrentWorkflow(data);
      return data;
    } catch (err) {
      console.error(`Error fetching n8n workflow ${workflowId}:`, err);
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Function to create a new workflow
  const createWorkflow = async (data: N8nWorkflowRequest) => {
    try {
      setLoading(true);
      const newWorkflow = await n8nWorkflowApi.createWorkflow(data);
      
      // Update the workflows list
      setWorkflows(prev => prev ? [...prev, newWorkflow] : [newWorkflow]);
      
      return newWorkflow;
    } catch (err) {
      console.error('Error creating n8n workflow:', err);
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Function to update a workflow
  const updateWorkflow = async (workflowId: string, data: Partial<N8nWorkflowRequest>) => {
    try {
      setLoading(true);
      const updatedWorkflow = await n8nWorkflowApi.updateWorkflow(workflowId, data);
      
      // Update the workflows list
      setWorkflows(prev => 
        prev ? prev.map(wf => wf.id === workflowId ? updatedWorkflow : wf) : [updatedWorkflow]
      );
      
      // Update current workflow if it's the one being edited
      if (currentWorkflow && currentWorkflow.id === workflowId) {
        setCurrentWorkflow(updatedWorkflow);
      }
      
      return updatedWorkflow;
    } catch (err) {
      console.error(`Error updating n8n workflow ${workflowId}:`, err);
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Function to delete a workflow
  const deleteWorkflow = async (workflowId: string) => {
    try {
      setLoading(true);
      await n8nWorkflowApi.deleteWorkflow(workflowId);
      
      // Update the workflows list
      setWorkflows(prev => prev ? prev.filter(wf => wf.id !== workflowId) : null);
      
      // Clear current workflow if it's the one being deleted
      if (currentWorkflow && currentWorkflow.id === workflowId) {
        setCurrentWorkflow(null);
      }
    } catch (err) {
      console.error(`Error deleting n8n workflow ${workflowId}:`, err);
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Function to activate a workflow
  const activateWorkflow = async (workflowId: string) => {
    try {
      return await updateWorkflow(workflowId, { active: true });
    } catch (err) {
      console.error(`Error activating n8n workflow ${workflowId}:`, err);
      throw err;
    }
  };

  // Function to deactivate a workflow
  const deactivateWorkflow = async (workflowId: string) => {
    try {
      return await updateWorkflow(workflowId, { active: false });
    } catch (err) {
      console.error(`Error deactivating n8n workflow ${workflowId}:`, err);
      throw err;
    }
  };

  return {
    workflows,
    currentWorkflow,
    loading,
    error,
    fetchWorkflow,
    createWorkflow,
    updateWorkflow,
    deleteWorkflow,
    activateWorkflow,
    deactivateWorkflow
  };
}
