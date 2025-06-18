"use client";

import { useState, useCallback, useEffect } from 'react';
import { 
  FlowNode, 
  FlowEdge, 
  AgentDefinition,
  AgentNodeType 
} from '../../types';
import { 
  NodeChange, 
  EdgeChange, 
  Connection, 
  applyNodeChanges, 
  applyEdgeChanges, 
  addEdge 
} from 'reactflow';
import { debounce } from '../../components/agent/utils';

// Helper function to get default node data based on node type
export function getDefaultNodeData(nodeType: AgentNodeType): any {
  switch (nodeType) {
    case AgentNodeType.MESSAGE:
      return { message: 'Enter your message here' };
    case AgentNodeType.LISTEN:
      return { variableName: 'user_input' };
    case AgentNodeType.CHOICE:
      return { 
        choices: [
          { label: 'Option 1', value: 'option_1' },
          { label: 'Option 2', value: 'option_2' }
        ] 
      };
    case AgentNodeType.CONDITION:
      return { 
        variable: 'condition_var',
        operator: 'equals',
        value: 'true'
      };
    case AgentNodeType.SET_VARIABLE:
      return { 
        assignments: [{ variableName: 'new_variable', value: '', evaluate: false }]
      };
    case AgentNodeType.API_CALL:
      return { 
        url: 'https://api.example.com',
        method: 'GET',
        headers: {},
        responseVariableName: 'api_response'
      };
    case AgentNodeType.TOOL_CALL:
      return { 
        toolId: '',
        inputMapping: {}
      };
    default:
      return {};
  }
}

export function useAgent(agentId: string, agentApi: any) {
  // State declarations
  const [agent, setAgent] = useState<AgentDefinition | null>(null);
  const [agentName, setAgentName] = useState<string>('');
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<FlowEdge[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [isRunDialogOpen, setIsRunDialogOpen] = useState<boolean>(false);
  const [isPublished, setIsPublished] = useState<boolean>(false);

  // Fetch agent data
  const fetchAgent = useCallback(async () => {
    if (!agentId || agentId === 'create') return;
    
    try {
      setIsLoading(true);
      const data = await agentApi.getAgent(agentId);
      
      if (data) {
        setAgent(data);
        setAgentName(data.name || 'Untitled Agent');
        setIsPublished(data.isPublished || false);
        
        // Initialize nodes and edges from agent data
        const sanitizedData = sanitizeAgentData(data);
        setNodes(sanitizedData.nodes);
        setEdges(sanitizedData.edges);
      }
    } catch (error) {
      console.error('Error fetching agent:', error);
    } finally {
      setIsLoading(false);
    }
  }, [agentId, agentApi]);

  // Helper function to sanitize agent data
  const sanitizeAgentData = (agentData: any) => {
    // Ensure nodes is an array and has valid positions
    let nodes: FlowNode[] = Array.isArray(agentData?.nodes) 
      ? agentData.nodes.map((node: any, index: number) => {
          // Ensure node has a valid position
          if (!node.position || typeof node.position.x !== 'number' || typeof node.position.y !== 'number') {
            node.position = {
              x: Math.random() * 400 + 50,
              y: Math.random() * 200 + 50,
            };
          }
          
          // Add block number and test handler function
          node.data = {
            ...node.data,
            blockNumber: index + 1,
            onTest: (nodeId: string) => {
              // This will be replaced when the nodes are loaded in the component
              console.log('Test node:', nodeId);
            }
          };
          
          return node;
        })
      : [];

    // Ensure edges is an array and filter out invalid edges
    let edges: FlowEdge[] = Array.isArray(agentData?.edges)
      ? agentData.edges.filter((edge: any) => edge.source && edge.target)
      : [];

    return { nodes, edges };
  };

  // Save agent with debounce
  const saveAgent = useCallback(async () => {
    if (!agentId || isLoading) return;
    
    try {
      setIsSaving(true);
      
      const agentData = {
        id: agentId,
        name: agentName,
        nodes,
        edges,
        isPublished,
      };
      
      await agentApi.updateAgent(agentId, agentData);
      console.log('Agent saved successfully');
    } catch (error) {
      console.error('Error saving agent:', error);
    } finally {
      setIsSaving(false);
    }
  }, [agentId, agentName, nodes, edges, isLoading, isPublished, agentApi]);

  // Debounced auto-save
  const debouncedSave = useCallback(debounce(saveAgent, 2000), [saveAgent]);

  // Schedule auto-save
  const scheduleAutoSave = useCallback(() => {
    if (agentId && agentId !== 'create') {
      debouncedSave();
    }
  }, [agentId, debouncedSave]);

  // Publish agent
  const publishAgent = useCallback(async () => {
    if (!agentId) return;
    
    try {
      await agentApi.publishAgent(agentId);
      setIsPublished(true);
      console.log('Agent published successfully');
    } catch (error) {
      console.error('Error publishing agent:', error);
    }
  }, [agentId, agentApi]);

  // Node changes handler
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds) as FlowNode[]);
    scheduleAutoSave();
  }, [scheduleAutoSave]);

  // Edge changes handler
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds) as FlowEdge[]);
    scheduleAutoSave();
  }, [scheduleAutoSave]);

  // Connect nodes handler
  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) => addEdge({ ...connection, type: 'smoothstep' }, eds) as FlowEdge[]);
    scheduleAutoSave();
  }, [scheduleAutoSave]);

  // Update node data
  const updateNodeData = useCallback((nodeId: string, data: any) => {
    setNodes(nds => nds.map(node => {
      if (node.id === nodeId) {
        return { ...node, data: { ...node.data, ...data } };
      }
      return node;
    }));
    scheduleAutoSave();
  }, [scheduleAutoSave]);

  // Load agent on mount
  useEffect(() => {
    fetchAgent();
  }, [fetchAgent]);

  return {
    agent,
    agentName,
    setAgentName,
    nodes,
    setNodes,
    edges,
    setEdges,
    isLoading,
    isSaving,
    selectedNode,
    setSelectedNode,
    isRunDialogOpen,
    setIsRunDialogOpen,
    isPublished,
    onNodesChange,
    onEdgesChange,
    onConnect,
    updateNodeData,
    saveAgent,
    publishAgent,
    scheduleAutoSave
  };
}
