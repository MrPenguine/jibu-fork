## 3. Frontend Implementation (Next.js)

### A. Integration Node Component - The User-Facing Wrapper

```tsx
// components/agent-builder/IntegrationNode.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Select, SelectItem, Input, Button, Card, CardBody, CardHeader, Divider } from '@nextui-org/react';
import { useAgentBuilder } from '@/context/AgentBuilderContext';
import { useN8nNodes } from '@/hooks/useN8nNodes';
import { IntegrationNodeProps } from '@/types/agent-builder';

export const IntegrationNode: React.FC<IntegrationNodeProps> = ({
  nodeId,
  initialData,
  onSave,
  onCancel
}) => {
  const { currentAgent, updateNode } = useAgentBuilder();
  const { nodes: allNodes, loading, error } = useN8nNodes();
  const [selectedApp, setSelectedApp] = useState(initialData?.integrationType || '');
  const [selectedOperation, setSelectedOperation] = useState(initialData?.operation || '');
  const [parameters, setParameters] = useState(initialData?.parameters || {});
  const [credentials, setCredentials] = useState(initialData?.credentials || null);
  const [apps, setApps] = useState<any[]>([]);
  const [operations, setOperations] = useState<any[]>([]);
  const [credentialOptions, setCredentialOptions] = useState<any[]>([]);

  useEffect(() => {
    if (allNodes) {
      // Group nodes by application
      const appMap = new Map();
      allNodes.forEach(node => {
        if (!appMap.has(node.group)) {
          appMap.set(node.group, {
            name: node.group,
            icon: node.icon,
            nodes: []
          });
        }
        appMap.get(node.group).nodes.push(node);
      });
      
      setApps(Array.from(appMap.values()));
    }
  }, [allNodes]);

  useEffect(() => {
    if (selectedApp && allNodes) {
      const appNodes = allNodes.filter(node => node.group === selectedApp);
      setOperations(appNodes);
      
      // Reset operation if current one isn't available
      if (selectedOperation && !appNodes.some(node => node.name === selectedOperation)) {
        setSelectedOperation('');
        setParameters({});
      }
    }
  }, [selectedApp, allNodes]);

  useEffect(() => {
    if (selectedApp && currentAgent) {
      // Fetch available credentials for this app
      const fetchCredentials = async () => {
        try {
          const response = await fetch(`/api/agents/${currentAgent.id}/credentials?app=${selectedApp}`);
          const data = await response.json();
          setCredentialOptions(data);
          
          // Auto-select existing credential if available
          if (initialData?.credentials && data.some(c => c.id === initialData.credentials.id)) {
            setCredentials(initialData.credentials);
          } else if (data.length > 0) {
            setCredentials(data[0]);
          }
        } catch (err) {
          console.error('Failed to fetch credentials', err);
        }
      };
      
      fetchCredentials();
    }
  }, [selectedApp, currentAgent]);

  const handleSave = () => {
    onSave({
      type: 'integration',
      integrationType: selectedApp,
      operation: selectedOperation,
      parameters,
      credentials,
    });
  };

  const renderParameterFields = () => {
    if (!selectedOperation || !allNodes) return null;
    
    const node = allNodes.find(n => n.name === selectedOperation);
    if (!node) return null;

    return (
      <div className="space-y-4 mt-4">
        {node.properties.map((param: any) => (
          <div key={param.name} className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              {param.displayName}
              {param.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {param.type === 'string' && (
              <Input
                value={parameters[param.name] || ''}
                onChange={(e) => 
                  setParameters({...parameters, [param.name]: e.target.value})
                }
                placeholder={param.default || ''}
              />
            )}
            {param.type === 'options' && (
              <Select
                selectedKeys={parameters[param.name] ? [parameters[param.name]] : []}
                onSelectionChange={(keys) => 
                  setParameters({...parameters, [param.name]: Array.from(keys)[0]})
                }
              >
                {param.options.map((option: any) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.name}
                  </SelectItem>
                ))}
              </Select>
            )}
            {param.type === 'boolean' && (
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={!!parameters[param.name]}
                  onChange={(e) => 
                    setParameters({...parameters, [param.name]: e.target.checked})
                  }
                  className="h-4 w-4 text-blue-600"
                />
                <span className="ml-2 text-sm text-gray-700">
                  {param.displayName}
                </span>
              </div>
            )}
            <p className="text-xs text-gray-500">{param.description}</p>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <h3 className="text-lg font-semibold">Integration Configuration</h3>
      </CardHeader>
      <Divider />
      <CardBody>
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">
            Failed to load integration nodes: {error.message}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Application
            </label>
            <Select
              placeholder="Select an application"
              selectedKeys={selectedApp ? [selectedApp] : []}
              onSelectionChange={(keys) => {
                setSelectedApp(Array.from(keys)[0] as string);
                setSelectedOperation('');
                setParameters({});
              }}
            >
              {apps.map(app => (
                <SelectItem key={app.name} value={app.name}>
                  {app.name}
                </SelectItem>
              ))}
            </Select>
          </div>

          {selectedApp && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Action
              </label>
              <Select
                placeholder="Select an action"
                selectedKeys={selectedOperation ? [selectedOperation] : []}
                onSelectionChange={(keys) => 
                  setSelectedOperation(Array.from(keys)[0] as string)
                }
              >
                {operations.map(op => (
                  <SelectItem key={op.name} value={op.name}>
                    {op.displayName}
                  </SelectItem>
                ))}
              </Select>
            </div>
          )}

          {selectedApp && credentialOptions.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Credentials
              </label>
              <Select
                placeholder="Select credentials"
                selectedKeys={credentials ? [credentials.id] : []}
                onSelectionChange={(keys) => {
                  const credId = Array.from(keys)[0] as string;
                  const cred = credentialOptions.find(c => c.id === credId);
                  setCredentials(cred);
                }}
              >
                {credentialOptions.map(cred => (
                  <SelectItem key={cred.id} value={cred.id}>
                    {cred.name} {cred.isDefault && '(Default)'}
                  </SelectItem>
                ))}
              </Select>
            </div>
          )}

          {selectedOperation && renderParameterFields()}

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="bordered" onPress={onCancel}>
              Cancel
            </Button>
            <Button color="primary" onPress={handleSave} disabled={!selectedApp || !selectedOperation}>
              Save
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};
```

### B. n8n Nodes Hook - Dynamic UI Generation

```tsx
// hooks/useN8nNodes.ts
import { useState, useEffect } from 'react';
import type { N8nNode } from '@/types/n8n';

export function useN8nNodes() {
  const [nodes, setNodes] = useState<N8nNode[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchNodes = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/n8n/nodes');
        
        if (!response.ok) {
          throw new Error('Failed to fetch n8n nodes');
        }
        
        const data = await response.json();
        setNodes(data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchNodes();
  }, []);

  return { nodes, loading, error };
}
```

### C. API Routes for n8n Integration

```ts
// pages/api/n8n/nodes.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { N8nService } from '@/services/n8n/n8n.service';
import { initializeNestApp } from '@/lib/nest';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const app = await initializeNestApp();
    const n8nService = app.get(N8nService);
    
    // Get all integration nodes
    const nodes = await n8nService.getIntegrationNodes();
    
    // Transform to a format suitable for our UI
    const transformedNodes = nodes.map(node => ({
      name: node.name,
      displayName: node.displayName || node.name,
      group: node.group || 'Other',
      icon: node.icon,
      properties: node.properties?.map(prop => ({
        name: prop.name,
        displayName: prop.displayName || prop.name,
        type: prop.type,
        required: prop.required || false,
        options: prop.options,
        description: prop.description,
        default: prop.default
      })) || []
    }));

    res.status(200).json(transformedNodes);
  } catch (error) {
    console.error('Error fetching n8n nodes:', error);
    res.status(500).json({ 
      message: 'Failed to fetch n8n nodes', 
      error: error.message 
    });
  }
}
```

### D. Agent Builder Context - State Management

```tsx
// context/AgentBuilderContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Agent, Node, IntegrationNode } from '@/types/agent-builder';

interface AgentBuilderContextType {
  currentAgent: Agent | null;
  nodes: Node[];
  selectedNode: Node | null;
  addNode: (node: Node) => void;
  updateNode: (nodeId: string, updates: Partial<Node>) => void;
  deleteNode: (nodeId: string) => void;
  selectNode: (nodeId: string | null) => void;
  saveAgent: () => Promise<void>;
  testAgent: () => void;
  deployAgent: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

const AgentBuilderContext = createContext<AgentBuilderContextType | undefined>(undefined);

export function AgentBuilderProvider({ children }: { children: ReactNode }) {
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAgent = async () => {
      try {
        setLoading(true);
        const agentId = getAgentIdFromUrl();
        if (!agentId) return;
        
        const response = await fetch(`/api/agents/${agentId}`);
        const data = await response.json();
        
        setCurrentAgent(data);
        setNodes(data.nodes || []);
      } catch (err) {
        setError('Failed to load agent');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    loadAgent();
  }, []);

  const addNode = (node: Node) => {
    setNodes(prev => [...prev, node]);
    selectNode(node.id);
  };

  const updateNode = (nodeId: string, updates: Partial<Node>) => {
    setNodes(prev => 
      prev.map(node => 
        node.id === nodeId ? { ...node, ...updates } : node
      )
    );
    
    if (selectedNode?.id === nodeId) {
      setSelectedNode(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const deleteNode = (nodeId: string) => {
    setNodes(prev => prev.filter(node => node.id !== nodeId));
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
    }
  };

  const selectNode = (nodeId: string | null) => {
    if (!nodeId) {
      setSelectedNode(null);
      return;
    }
    
    const node = nodes.find(n => n.id === nodeId);
    setSelectedNode(node || null);
  };

  const saveAgent = async () => {
    if (!currentAgent) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Filter for integration nodes only
      const integrationNodes = nodes.filter(node => node.type === 'integration') as IntegrationNode[];
      
      // Save to backend
      await fetch(`/api/agents/${currentAgent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes,
          integrationNodes
        })
      });
      
      // Sync integration nodes with n8n
      if (integrationNodes.length > 0) {
        await fetch(`/api/agents/${currentAgent.id}/sync-integrations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ integrationNodes })
        });
      }
    } catch (err) {
      setError('Failed to save agent');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const testAgent = () => {
    // Implementation for testing the agent
    console.log('Testing agent', currentAgent?.id);
  };

  const deployAgent = async () => {
    if (!currentAgent) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/agents/${currentAgent.id}/deploy`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('Deployment failed');
      }
    } catch (err) {
      setError('Failed to deploy agent');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AgentBuilderContext.Provider value={{
      currentAgent,
      nodes,
      selectedNode,
      addNode,
      updateNode,
      deleteNode,
      selectNode,
      saveAgent,
      testAgent,
      deployAgent,
      loading,
      error
    }}>
      {children}
    </AgentBuilderContext.Provider>
  );
}

export function useAgentBuilder() {
  const context = useContext(AgentBuilderContext);
  if (context === undefined) {
    throw new Error('useAgentBuilder must be used within an AgentBuilderProvider');
  }
  return context;
}
```