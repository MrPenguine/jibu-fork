"use client";

import { useState, useCallback, useEffect } from 'react';
import { 
  FlowNode, 
  FlowEdge, 
  WorkflowDefinition,
  WorkflowNodeType 
} from '../../types';
import { 
  NodeChange, 
  EdgeChange, 
  Connection, 
  applyNodeChanges, 
  applyEdgeChanges, 
  addEdge 
} from 'reactflow';
import { debounce } from '../../components/workflow/utils';

// Helper function to get default node data based on node type
export function getDefaultNodeData(nodeType: WorkflowNodeType): any {
  switch (nodeType) {
    case WorkflowNodeType.MESSAGE:
      return { message: 'Enter your message here' };
    case WorkflowNodeType.LISTEN:
      return { variableName: 'user_input' };
    case WorkflowNodeType.CHOICE:
      return { 
        choices: [
          { label: 'Option 1', value: 'option_1' },
          { label: 'Option 2', value: 'option_2' }
        ] 
      };
    case WorkflowNodeType.CONDITION:
      return { 
        variable: 'condition_var',
        operator: 'equals',
        value: 'true'
      };
    case WorkflowNodeType.SET_VARIABLE:
      return { 
        assignments: [{ variableName: 'new_variable', value: '', evaluate: false }]
      };
    case WorkflowNodeType.API_CALL:
      return { 
        url: 'https://api.example.com',
        method: 'GET',
        headers: {},
        responseVariableName: 'api_response'
      };
    case WorkflowNodeType.TOOL_CALL:
      return { 
        toolId: '',
        inputMapping: {}
      };
    default:
      return {};
  }
}

export function useWorkflow(workflowId: string, workflowApi: any) {
  // State declarations
  const [workflow, setWorkflow] = useState<WorkflowDefinition | null>(null);
  const [workflowName, setWorkflowName] = useState<string>('');
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<FlowEdge[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [isRunDialogOpen, setIsRunDialogOpen] = useState<boolean>(false);
  const [isPublished, setIsPublished] = useState<boolean>(false);

  // Fetch workflow data
  const fetchWorkflow = useCallback(async () => {
    if (!workflowId || workflowId === 'create') return;
    
    try {
      setIsLoading(true);
      const data = await workflowApi.getWorkflow(workflowId);
      
      if (data) {
        setWorkflow(data);
        setWorkflowName(data.name || 'Untitled Workflow');
        setIsPublished(data.isPublished || false);
        
        // Initialize nodes and edges from workflow data
        const sanitizedData = sanitizeWorkflowData(data);
        setNodes(sanitizedData.nodes);
        setEdges(sanitizedData.edges);
      }
    } catch (error) {
      console.error('Error fetching workflow:', error);
    } finally {
      setIsLoading(false);
    }
  }, [workflowId, workflowApi]);

  // Helper function to sanitize workflow data
  const sanitizeWorkflowData = (workflowData: any) => {
    // Ensure nodes is an array and has valid positions
    let nodes: FlowNode[] = Array.isArray(workflowData?.nodes) 
      ? workflowData.nodes.map((node: any, index: number) => {
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
    let edges: FlowEdge[] = Array.isArray(workflowData?.edges)
      ? workflowData.edges.filter((edge: any) => edge.source && edge.target)
      : [];

    return { nodes, edges };
  };

  // Save workflow with debounce
  const saveWorkflow = useCallback(async () => {
    if (!workflowId || isLoading) return;
    
    try {
      setIsSaving(true);
      
      const workflowData = {
        id: workflowId,
        name: workflowName,
        nodes,
        edges,
        isPublished,
      };
      
      await workflowApi.updateWorkflow(workflowId, workflowData);
      console.log('Workflow saved successfully');
    } catch (error) {
      console.error('Error saving workflow:', error);
    } finally {
      setIsSaving(false);
    }
  }, [workflowId, workflowName, nodes, edges, isLoading, isPublished, workflowApi]);

  // Debounced auto-save
  const debouncedSave = useCallback(debounce(saveWorkflow, 2000), [saveWorkflow]);

  // Schedule auto-save
  const scheduleAutoSave = useCallback(() => {
    if (workflowId && workflowId !== 'create') {
      debouncedSave();
    }
  }, [workflowId, debouncedSave]);

  // Publish workflow
  const publishWorkflow = useCallback(async () => {
    if (!workflowId) return;
    
    try {
      await workflowApi.publishWorkflow(workflowId);
      setIsPublished(true);
      console.log('Workflow published successfully');
    } catch (error) {
      console.error('Error publishing workflow:', error);
    }
  }, [workflowId, workflowApi]);

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

  // Load workflow on mount
  useEffect(() => {
    fetchWorkflow();
  }, [fetchWorkflow]);

  return {
    workflow,
    workflowName,
    setWorkflowName,
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
    saveWorkflow,
    publishWorkflow,
    scheduleAutoSave
  };
}
