import { useState, useEffect, useCallback } from 'react';
import { getAuthHeaders } from '../utils/auth';

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  duration?: number;
}

export interface DetailedExecution extends WorkflowExecution {
  inputData: any;
  outputData: any;
  nodes: ExecutionNode[];
  logs: ExecutionLog[];
}

export interface ExecutionNode {
  id: string;
  name: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  duration?: number;
  error?: string;
  inputData?: any;
  outputData?: any;
}

export interface ExecutionLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  nodeId?: string;
  message: string;
  data?: any;
}

export interface ExecutionFilters {
  workflowId?: string;
  status?: string;
  dateRange?: [Date | null, Date | null];
}

export function useWorkflowExecutions() {
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [executionDetails, setExecutionDetails] = useState<Record<string, DetailedExecution>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Fetch executions with optional filters
  const fetchExecutions = useCallback(async (filters: ExecutionFilters = {}) => {
    try {
      setLoading(true);
      
      const headers = await getAuthHeaders();
      
      // Build query string from filters
      const queryParams = new URLSearchParams();
      if (filters.workflowId) queryParams.append('workflowId', filters.workflowId);
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.dateRange && filters.dateRange[0]) {
        queryParams.append('startDate', filters.dateRange[0].toISOString());
      }
      if (filters.dateRange && filters.dateRange[1]) {
        queryParams.append('endDate', filters.dateRange[1].toISOString());
      }
      
      const queryString = queryParams.toString();
      const url = `/api/v1/workflow/executions${queryString ? `?${queryString}` : ''}`;
      
      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        throw new Error('Failed to fetch workflow executions');
      }
      
      const data = await response.json();
      setExecutions(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching workflow executions:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch detailed execution by ID
  const fetchExecutionDetails = useCallback(async (executionId: string) => {
    try {
      // Check if we already have the details cached
      if (executionDetails[executionId]) {
        return executionDetails[executionId];
      }
      
      setLoading(true);
      
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/v1/workflow/executions/${executionId}`, { headers });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch execution details for ID: ${executionId}`);
      }
      
      const data = await response.json();
      
      // Cache the execution details
      setExecutionDetails(prev => ({
        ...prev,
        [executionId]: data
      }));
      
      return data;
    } catch (err) {
      console.error(`Error fetching execution details for ${executionId}:`, err);
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [executionDetails]);

  // Re-run an execution
  const rerunExecution = useCallback(async (executionId: string) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/v1/workflow/executions/${executionId}/rerun`, {
        method: 'POST',
        headers
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to re-run execution');
      }
      
      const data = await response.json();
      return data;
    } catch (err) {
      console.error('Error re-running execution:', err);
      throw err;
    }
  }, []);

  // Re-run a specific node in an execution
  const rerunNode = useCallback(async (executionId: string, nodeId: string) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/v1/workflow/executions/${executionId}/nodes/${nodeId}/rerun`, {
        method: 'POST',
        headers
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to re-run node');
      }
      
      const data = await response.json();
      return data;
    } catch (err) {
      console.error('Error re-running node:', err);
      throw err;
    }
  }, []);

  return {
    executions,
    loading,
    error,
    fetchExecutions,
    fetchExecutionDetails,
    rerunExecution,
    rerunNode
  };
}
