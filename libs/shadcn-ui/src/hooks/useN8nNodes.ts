import { useState, useEffect } from 'react';
import { getAuthHeaders } from '../utils/auth';

export interface N8nNodeParameter {
  name: string;
  displayName: string;
  type: string;
  required: boolean;
  options?: Array<{ value: string; name: string; description?: string }>;
  description?: string;
  default?: any;
  placeholder?: string;
  typeOptions?: any;
}

export interface N8nNode {
  name: string;
  displayName: string;
  group: string[];
  icon?: string;
  version: number;
  properties: N8nNodeParameter[];
  credentials?: Array<{
    name: string;
    required?: boolean;
  }>;
}

export interface N8nCredentialType {
  name: string;
  displayName: string;
  properties: N8nNodeParameter[];
}

export function useN8nNodes() {
  const [nodes, setNodes] = useState<N8nNode[] | null>(null);
  const [nodeDetails, setNodeDetails] = useState<Record<string, N8nNode>>({});
  const [credentialTypes, setCredentialTypes] = useState<N8nCredentialType[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch all nodes
  useEffect(() => {
    const fetchNodes = async () => {
      try {
        setLoading(true);
        const headers = await getAuthHeaders();
        const response = await fetch('/api/v1/n8n/nodes', { headers });
        
        if (!response.ok) {
          throw new Error('Failed to fetch n8n nodes');
        }
        
        const data = await response.json();
        
        if (Array.isArray(data)) {
          setNodes(data);
        } else if (data && data.data && Array.isArray(data.data)) {
          // Handle legacy format for backward compatibility
          setNodes(data.data);
        } else {
          console.error('Unexpected response format:', data);
          throw new Error('Invalid response format');
        }
      } catch (err) {
        console.error('Error fetching n8n nodes:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchNodes();
  }, []);

  // Fetch credential types
  useEffect(() => {
    const fetchCredentialTypes = async () => {
      try {
        const headers = await getAuthHeaders();
        const response = await fetch('/api/v1/n8n/credentials', { headers });
        
        if (!response.ok) {
          throw new Error('Failed to fetch n8n credential types');
        }
        
        const data = await response.json();
        
        if (Array.isArray(data)) {
          setCredentialTypes(data);
        } else if (data && data.data && Array.isArray(data.data)) {
          // Handle legacy format for backward compatibility
          setCredentialTypes(data.data);
        } else {
          console.error('Unexpected response format for credential types:', data);
          throw new Error('Invalid response format for credential types');
        }
      } catch (err) {
        console.error('Error fetching n8n credential types:', err);
        // We don't set the main error state here to avoid blocking the UI
      }
    };

    if (!loading && nodes) {
      fetchCredentialTypes();
    }
  }, [loading, nodes]);

  // Function to fetch node details
  const fetchNodeDetails = async (nodeType: string) => {
    if (nodeDetails[nodeType]) {
      return nodeDetails[nodeType];
    }

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/v1/n8n/nodes/${nodeType}`, { headers });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch details for node type: ${nodeType}`);
      }
      
      const data = await response.json();
        
      if (data) {
        // Check if it's the direct format or wrapped in a data property
        const nodeData = data.data ? data.data : data;
        setNodeDetails(prev => ({
          ...prev,
          [nodeType]: nodeData
        }));
        return nodeData;
      } else {
        console.error('Unexpected response format for node details:', data);
        throw new Error('Invalid response format for node details');
      }
    } catch (err) {
      console.error(`Error fetching details for node ${nodeType}:`, err);
      throw err;
    }
  };

  return { 
    nodes, 
    credentialTypes, 
    loading, 
    error, 
    fetchNodeDetails,
    nodeDetails
  };
}
