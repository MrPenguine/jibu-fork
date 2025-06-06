"use client";

import { useState, useCallback, useEffect } from 'react';
import { 
  FlowNode, 
  FlowEdge, 
  WorkflowDefinition,
  AgentNodeType 
} from '../../types';
import { 
  NodeChange, 
  EdgeChange, 
  Connection, 
  applyNodeChanges, 
  applyEdgeChanges, 
  addEdge,
  Viewport 
} from 'reactflow';
import { debounce } from '../../components/agent/utils';

export function useWorkflow(workflowId: string, workflowApi: any, orgId?: string) {
  // State declarations
  const [workflow, setWorkflow] = useState<WorkflowDefinition | null>(null);
  const [workflowName, setWorkflowName] = useState<string>('');
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<FlowEdge[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [isRunDialogOpen, setIsRunDialogOpen] = useState<boolean>(false);
  const [isPublished, setIsPublished] = useState<boolean>(false);
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Fetch workflow data
  const fetchWorkflow = useCallback(async () => {
    if (!workflowId || workflowId === 'create') return;
    
    try {
      setIsLoading(true);
      setSaveError(null);
      const data = await workflowApi.getWorkflow(workflowId, orgId);
      
      if (data) {
        setWorkflow(data);
        setWorkflowName(data.name || 'Untitled Workflow');
        setIsPublished(data.isPublished || false);
        
        // Initialize nodes and edges from workflow data
        const sanitizedData = sanitizeWorkflowData(data);
        setNodes(sanitizedData.nodes);
        setEdges(sanitizedData.edges);
        
        // Set viewport if it exists in the data
        if (data.viewport) {
          try {
            const viewportData = typeof data.viewport === 'string' 
              ? JSON.parse(data.viewport) 
              : data.viewport;
            setViewport(viewportData);
          } catch (err) {
            console.error('Error parsing viewport data:', err);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching workflow:', error);
      setSaveError('Failed to load workflow');
    } finally {
      setIsLoading(false);
    }
  }, [workflowId, workflowApi, orgId]);

  // Helper function to sanitize workflow data
  const sanitizeWorkflowData = (workflowData: any) => {
    // Parse nodes if they're stored as a string
    let parsedNodes = workflowData.nodes;
    if (typeof workflowData.nodes === 'string') {
      try {
        parsedNodes = JSON.parse(workflowData.nodes);
      } catch (e) {
        console.error('Error parsing nodes:', e);
        parsedNodes = [];
      }
    }
    
    // Parse edges if they're stored as a string
    let parsedEdges = workflowData.edges;
    if (typeof workflowData.edges === 'string') {
      try {
        parsedEdges = JSON.parse(workflowData.edges);
      } catch (e) {
        console.error('Error parsing edges:', e);
        parsedEdges = [];
      }
    }
    
    // Ensure nodes is an array and has valid positions
    let nodes: FlowNode[] = Array.isArray(parsedNodes) 
      ? parsedNodes.map((node: any, index: number) => {
          // Ensure node has a valid position
          if (!node.position || typeof node.position.x !== 'number' || typeof node.position.y !== 'number') {
            node.position = {
              x: Math.random() * 400 + 50,
              y: Math.random() * 200 + 50,
            };
          }
          
          // Add block number
          node.data = {
            ...node.data,
            blockNumber: index + 1,
          };
          
          return node;
        })
      : [];

    // Ensure edges is an array and filter out invalid edges
    let edges: FlowEdge[] = Array.isArray(parsedEdges)
      ? parsedEdges.filter((edge: any) => edge.source && edge.target)
      : [];

    return { nodes, edges };
  };

  // Save workflow with current viewport state
  const saveWorkflow = useCallback(async (currentViewport?: Viewport) => {
    if (!workflowId || isLoading) return;
    
    try {
      setIsSaving(true);
      setSaveError(null);
      
      // Use the most current viewport
      const viewportToSave = currentViewport || viewport;
      
      const workflowData = {
        id: workflowId,
        name: workflowName,
        nodes: JSON.stringify(nodes),
        edges: JSON.stringify(edges),
        isPublished,
        viewport: viewportToSave ? JSON.stringify(viewportToSave) : undefined
      };
      
      await workflowApi.updateWorkflow(workflowId, workflowData, orgId);
      setLastSavedAt(new Date());
      console.log('Workflow saved successfully');
    } catch (error) {
      console.error('Error saving workflow:', error);
      setSaveError('Failed to save workflow');
    } finally {
      setIsSaving(false);
    }
  }, [workflowId, workflowName, nodes, edges, isLoading, isPublished, viewport, workflowApi, orgId]);

  // Debounced auto-save
  const debouncedSave = useCallback(debounce(saveWorkflow, 2000), [saveWorkflow]);

  // Schedule auto-save
  const scheduleAutoSave = useCallback((currentViewport?: Viewport) => {
    if (workflowId && workflowId !== 'create') {
      if (currentViewport) {
        setViewport(currentViewport);
      }
      debouncedSave(currentViewport);
    }
  }, [workflowId, debouncedSave]);

  // Publish workflow
  const publishWorkflow = useCallback(async () => {
    if (!workflowId) return;
    
    try {
      await workflowApi.publishWorkflow(workflowId, orgId);
      setIsPublished(true);
      console.log('Workflow published successfully');
    } catch (error) {
      console.error('Error publishing workflow:', error);
      setSaveError('Failed to publish workflow');
    }
  }, [workflowId, workflowApi, orgId]);

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

  // Update viewport
  const updateViewport = useCallback((newViewport: Viewport) => {
    setViewport(newViewport);
    scheduleAutoSave(newViewport);
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
    saveError,
    selectedNode,
    setSelectedNode,
    isRunDialogOpen,
    setIsRunDialogOpen,
    isPublished,
    viewport,
    updateViewport,
    lastSavedAt,
    onNodesChange,
    onEdgesChange,
    onConnect,
    updateNodeData,
    saveWorkflow,
    publishWorkflow,
    scheduleAutoSave
  };
}
