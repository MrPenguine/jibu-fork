import { useState, useEffect, useCallback } from 'react';
import { getAuthHeaders } from '../utils/auth';

export interface Credential {
  id: string;
  name: string;
  type: string;
  createdAt: string;
  updatedAt: string;
}

export interface CredentialType {
  name: string;
  displayName: string;
  properties: Array<{
    name: string;
    displayName: string;
    type: string;
    required: boolean;
    default?: any;
    description?: string;
  }>;
}

export interface CreateCredentialParams {
  name: string;
  type: string;
  data: Record<string, any>;
}

export function useCredentials() {
  const [credentials, setCredentials] = useState<Record<string, Credential[]>>({});
  const [credentialTypes, setCredentialTypes] = useState<CredentialType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch all credentials
  const fetchCredentials = useCallback(async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      const response = await fetch('/api/v1/n8n/credentials', { headers });
      
      if (!response.ok) {
        throw new Error('Failed to fetch credentials');
      }
      
      const data = await response.json();
      
      // Group credentials by type
      const groupedCredentials: Record<string, Credential[]> = {};
      
      data.forEach((credential: Credential) => {
        if (!groupedCredentials[credential.type]) {
          groupedCredentials[credential.type] = [];
        }
        
        groupedCredentials[credential.type].push(credential);
      });
      
      setCredentials(groupedCredentials);
      setError(null);
    } catch (err) {
      console.error('Error fetching credentials:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch credential types
  const fetchCredentialTypes = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/v1/n8n/credential-types', { headers });
      
      if (!response.ok) {
        throw new Error('Failed to fetch credential types');
      }
      
      const data = await response.json();
      setCredentialTypes(data);
    } catch (err) {
      console.error('Error fetching credential types:', err);
      // We don't set the main error state here to avoid blocking the UI
    }
  }, []);

  // Create a new credential
  const createCredential = useCallback(async (params: CreateCredentialParams) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/v1/n8n/credentials', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create credential');
      }
      
      const data = await response.json();
      
      // Refresh credentials after creation
      await fetchCredentials();
      
      return data;
    } catch (err) {
      console.error('Error creating credential:', err);
      throw err;
    }
  }, [fetchCredentials]);

  // Test a credential
  const testCredential = useCallback(async (credentialId: string) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/v1/n8n/credentials/${credentialId}/test`, {
        method: 'POST',
        headers,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Credential test failed');
      }
      
      const data = await response.json();
      return data;
    } catch (err) {
      console.error('Error testing credential:', err);
      throw err;
    }
  }, []);

  // Delete a credential
  const deleteCredential = useCallback(async (credentialId: string) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/v1/n8n/credentials/${credentialId}`, {
        method: 'DELETE',
        headers,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete credential');
      }
      
      // Refresh credentials after deletion
      await fetchCredentials();
      
      return true;
    } catch (err) {
      console.error('Error deleting credential:', err);
      throw err;
    }
  }, [fetchCredentials]);

  // Get credential schema for a specific type
  const getCredentialSchema = useCallback(async (credentialType: string) => {
    try {
      // Check if we already have it in state
      const existingType = credentialTypes.find(type => type.name === credentialType);
      if (existingType) {
        return existingType;
      }
      
      // Otherwise fetch it
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/v1/n8n/credential-types/${credentialType}`, { headers });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch credential schema for type: ${credentialType}`);
      }
      
      const data = await response.json();
      return data;
    } catch (err) {
      console.error(`Error fetching credential schema for ${credentialType}:`, err);
      throw err;
    }
  }, [credentialTypes]);

  // Load data on component mount
  useEffect(() => {
    fetchCredentials();
    fetchCredentialTypes();
  }, [fetchCredentials, fetchCredentialTypes]);

  return {
    credentials,
    credentialTypes,
    loading,
    error,
    fetchCredentials,
    createCredential,
    testCredential,
    deleteCredential,
    getCredentialSchema,
  };
}
