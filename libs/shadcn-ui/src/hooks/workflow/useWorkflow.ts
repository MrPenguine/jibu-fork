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
  Viewport,
  Node as ReactFlowNode // Import Node and alias to avoid conflict if FlowNode is used elsewhere as a specific type
} from 'reactflow';
import { debounce } from '../../components/agent/utils';
import { useAssistants } from '../../../../../apps/frontend/src/utils/AssistantsApi'; // Added for backend calls
import { KnowledgeBaseSearchNodeData } from '../../components/agent/nodes/KnowledgeBaseSearchNode'; // Added for type safety
import { AssistantNodeData } from '../../components/agent/nodes/AssistantNode'; // Added for type safety

export function useWorkflow(workflowId: string, workflowApi: any, orgId?: string) {
  const { removeKnowledgeBaseFromAssistant, linkKnowledgeBaseToAssistant } = useAssistants(); // Added for backend calls
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

  // Utility function to deduplicate edges
  const deduplicateEdges = useCallback((inputEdges: FlowEdge[]): FlowEdge[] => {
    const uniqueEdgesById = Array.from(new Map(inputEdges.map(edge => [edge.id, edge])).values());
    if (inputEdges.length !== uniqueEdgesById.length) {
      console.warn(
        '[Workflow] Duplicate edge IDs detected and resolved. Original count:',
        inputEdges.length,
        'Unique count:',
        uniqueEdgesById.length
      );
    }
    return uniqueEdgesById;
  }, []);

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

  // We'll invoke fetchWorkflow to load the data instead of having two competing mechanisms
  useEffect(() => {
    fetchWorkflow();
  }, [fetchWorkflow]);


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

    // Ensure nodes is an array and filter out invalid nodes
    let nodes: FlowNode[] = [];
    if (Array.isArray(parsedNodes)) {
      nodes = parsedNodes
        .filter((node: any) => node.id)
        .map((node: any, index: number) => {
          // Add block number
          return {
            ...node,
            data: {
              ...node.data,
              blockNumber: index + 1,
            }
          };
        });
    }

    // Ensure edges is an array, filter out invalid edges, and deduplicate
    let rawEdges: FlowEdge[] = Array.isArray(parsedEdges)
      ? parsedEdges.filter((edge: any) => edge.source && edge.target)
      : [];
      
    // Deduplicate edges on initial load to prevent React key issues
    const uniqueEdges = deduplicateEdges(rawEdges);
    if (uniqueEdges.length !== rawEdges.length) {
      console.warn(`[Workflow] Found and removed ${rawEdges.length - uniqueEdges.length} duplicate edges during workflow data sanitization`);
    }

    return { nodes, edges: uniqueEdges };
  };

  // Save workflow with current viewport state
  const saveWorkflow = useCallback(async (currentViewport?: Viewport, isNewWorkflow?: boolean) => {
    if (!workflowId || isLoading) return;
    
    try {
      setIsSaving(true);
      setSaveError(null);
      
      // Use the most current viewport
      const viewportToSave = currentViewport || viewport;
      
      // For brand new secondary workflows, explicitly use empty arrays to ensure clean state
      const nodesToSave = isNewWorkflow ? [] : nodes;
      const edgesToSave = isNewWorkflow ? [] : edges;
      
      const workflowData = {
        id: workflowId,
        name: workflowName,
        nodes: JSON.stringify(nodesToSave),
        edges: JSON.stringify(edgesToSave),
        isPublished,
        viewport: viewportToSave ? JSON.stringify(viewportToSave) : undefined
      };
      
      console.log(`Saving workflow ${workflowId}${isNewWorkflow ? ' as new workflow with empty data' : ''}`);
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
  const onNodesChange = useCallback(async (changes: NodeChange[]) => {
    // Special handling for node removal (to handle API cleanup for KB nodes)
    for (const change of changes) {
      if (change.type === 'remove') {
        const nodeIdToRemove = change.id;
        // Find the node from the current state *before* it's removed by applyNodeChanges
        const nodeToRemove = nodes.find(n => n.id === nodeIdToRemove);

        if (nodeToRemove && nodeToRemove.type === AgentNodeType.KNOWLEDGE_BASE_SEARCH) {
          const kbNodeData = nodeToRemove.data as KnowledgeBaseSearchNodeData;
          // If the KB node was connected to an assistant and had a KB selected, unlink from backend
          if (kbNodeData.connectedAssistantId && kbNodeData.knowledgeBaseId) {
            try {
              console.log(`[Workflow] Deleting KBNode ${nodeIdToRemove}, unlinking KB ${kbNodeData.knowledgeBaseId} from Assistant ${kbNodeData.connectedAssistantId}`);
              await removeKnowledgeBaseFromAssistant(kbNodeData.connectedAssistantId);
              console.log(`[Workflow] Successfully unlinked KB from Assistant ${kbNodeData.connectedAssistantId} via API due to KBNode deletion.`);
            } catch (error) {
              console.error(`[Workflow] Error unlinking KB from Assistant ${kbNodeData.connectedAssistantId} via API:`, error);
              // Optionally, notify the user or handle the error appropriately
            }
          }
        }
      } else if (change.type === 'position') {
        // For position changes, force deduplication of edges to prevent React duplicate key warnings
        // This runs AFTER the node position is updated but BEFORE React re-renders the edges
        setEdges(currentEdges => {
          const uniqueEdgesById = Array.from(new Map(currentEdges.map(edge => [edge.id, edge])).values());
          if (currentEdges.length !== uniqueEdgesById.length) {
            console.warn(
              `[Workflow] Duplicate edge IDs detected and resolved during node movement of ${change.id}. Original count:`,
              currentEdges.length,
              'Unique count:',
              uniqueEdgesById.length
            );
            return uniqueEdgesById;
          }
          return currentEdges;
        });
      }
    }

    setNodes((nds) => applyNodeChanges(changes, nds) as FlowNode[]);
    scheduleAutoSave();
  }, [nodes, scheduleAutoSave, removeKnowledgeBaseFromAssistant, setEdges]);


  
  // Edge changes handler
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => {
      // Apply React Flow's standard edge changes
      const newEdges = applyEdgeChanges(changes, eds) as FlowEdge[];
      
      // Always ensure edges are deduplicated
      return deduplicateEdges(newEdges);
    });
    scheduleAutoSave();
  }, [scheduleAutoSave, setEdges, deduplicateEdges]);

  // Connect nodes handler
  const onConnect = useCallback(async (connection: Connection) => {
    // Optimistically add the edge with a specific type
    if (!connection.source || !connection.target) {
      console.warn('[Workflow] onConnect called with invalid connection (null source/target). Aborting.', connection);
      return; // Do not proceed if source or target is null
    }

    // Ensure a unique ID for the new edge. React Flow typically generates this if not provided for a Connection object,
    // but since we're specifying a 'type', 'addEdge' expects an Edge-like object which includes an 'id'.
    const newEdgeId = `rf__edge-${connection.source}${connection.sourceHandle ?? ''}-${connection.target}${connection.targetHandle ?? ''}`;

    const edgeToAdd: FlowEdge = {
      id: newEdgeId,
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle ?? undefined,
      targetHandle: connection.targetHandle ?? undefined,
      type: 'smoothstep',
    };
    
    // Make sure we deduplicate when adding new edges too
    setEdges((eds) => {
      const newEdges = addEdge(edgeToAdd, eds) as FlowEdge[];
      return deduplicateEdges(newEdges);
    });

    const sourceNode = nodes.find(n => n.id === connection.source);
    const targetNode = nodes.find(n => n.id === connection.target);

    // Case 1: Connecting Assistant (source) to KnowledgeBaseSearch (target)
    if (
      sourceNode &&
      targetNode &&
      sourceNode.type === AgentNodeType.ASSISTANT &&
      targetNode.type === AgentNodeType.KNOWLEDGE_BASE_SEARCH &&
      connection.sourceHandle === 'kb-connection' && // Ensure correct handle
      connection.targetHandle === 'kb-connection-target' // Ensure correct handle
    ) {
      const assistantNode = sourceNode as ReactFlowNode<AssistantNodeData>;
      const kbSearchNode = targetNode as ReactFlowNode<KnowledgeBaseSearchNodeData>;
      
      const assistantApiId = assistantNode.data.apiAssistantId;
      const kbIdToLink = kbSearchNode.data.knowledgeBaseId;
      const kbNameToLink = kbSearchNode.data.knowledgeBaseName;

      if (!assistantApiId) {
        console.error(`[Workflow] Manual connection: AssistantNode ${assistantNode.id} is missing apiAssistantId. Cannot link.`);
        setEdges((eds) => 
          eds.filter(
            (e) =>
              !(
                e.source === connection.source &&
                e.target === connection.target &&
                e.sourceHandle === connection.sourceHandle &&
                e.targetHandle === connection.targetHandle &&
                e.type === 'smoothstep'
              )
          )
        ); // Remove edge if critical ID is missing
        return;
      }

      if (kbIdToLink) {
        setNodes((nds) =>
          nds.map((n) => {
            if (n.id === assistantNode.id) {
              return {
                ...n,
                data: { ...n.data, knowledgeBaseId: kbIdToLink, knowledgeBaseName: kbNameToLink },
              };
            }
            if (n.id === kbSearchNode.id) {
              return {
                ...n,
                data: { ...n.data, connectedAssistantId: assistantApiId }, // Use backend API ID
              };
            }
            return n;
          })
        );
        try {
          console.log(`[Workflow] Manual connection: Linking Assistant (API ID: ${assistantApiId}) to KB ${kbIdToLink}`);
          await linkKnowledgeBaseToAssistant(assistantApiId, kbIdToLink); // Use backend API ID
          console.log(`[Workflow] Successfully linked Assistant (API ID: ${assistantApiId}) to KB ${kbIdToLink} via API.`);
        } catch (error) {
          console.error(`[Workflow] Error linking Assistant (API ID: ${assistantApiId}) to KB ${kbIdToLink} via API:`, error);
        }
      } else {
        console.warn(`[Workflow] Manual connection: Target KBNode ${kbSearchNode.id} does not have a knowledgeBaseId selected. Edge created. Updating KBNode with assistant API ID.`);
        // Still update connectedAssistantId on KB node for potential future use
        setNodes((nds) => nds.map(n => {
            if (n.id === kbSearchNode.id) {
                return {...n, data: {...n.data, connectedAssistantId: assistantApiId }};
            }
            return n;
        }));
      }
    } 
    // Case 2: Connecting KnowledgeBaseSearch (source) to Assistant (target)
    else if (
      sourceNode &&
      targetNode &&
      sourceNode.type === AgentNodeType.KNOWLEDGE_BASE_SEARCH &&
      targetNode.type === AgentNodeType.ASSISTANT &&
      connection.sourceHandle === 'kb-connection-source' && // Example handle
      connection.targetHandle === 'assistant-target-for-kb'   // Example handle
    ) {
        const kbNode = sourceNode as ReactFlowNode<KnowledgeBaseSearchNodeData>;
        const assistantNode = targetNode as ReactFlowNode<AssistantNodeData>;

        const kbIdToLink = kbNode.data.knowledgeBaseId;
        const assistantApiId = assistantNode.data.apiAssistantId;

        if (!assistantApiId) {
            console.error(`[Workflow] Manual connection (KB->Asst): AssistantNode ${assistantNode.id} is missing apiAssistantId. Cannot link.`);
            setEdges((eds) => 
              eds.filter(
                (e) =>
                  !(
                    e.source === connection.source &&
                    e.target === connection.target &&
                    e.sourceHandle === connection.sourceHandle &&
                    e.targetHandle === connection.targetHandle &&
                    e.type === 'smoothstep'
                  )
              )
            );
            return;
        }
        
        if (kbIdToLink) {
            setNodes((nds) => nds.map(n => {
                if (n.id === assistantNode.id) { // Update assistant
                    return {...n, data: {...n.data, knowledgeBaseId: kbIdToLink, knowledgeBaseName: kbNode.data.knowledgeBaseName }};
                }
                if (n.id === kbNode.id) { // Update KB node
                    return {...n, data: {...n.data, connectedAssistantId: assistantApiId }};
                }
                return n;
            }));
            try {
                console.log(`[Workflow] Manual connection (KB->Asst): Linking Assistant (API ID: ${assistantApiId}) to KB ${kbIdToLink}`);
                await linkKnowledgeBaseToAssistant(assistantApiId, kbIdToLink);
                console.log(`[Workflow] Successfully linked Assistant (API ID: ${assistantApiId}) to KB ${kbIdToLink} via API.`);
            } catch (error) {
                console.error(`[Workflow] Error linking Assistant (API ID: ${assistantApiId}) to KB ${kbIdToLink} via API:`, error);
            }
        } else {
            console.warn(`[Workflow] Manual connection (KB->Asst): Source KBNode ${kbNode.id} does not have a knowledgeBaseId. Edge created. Updating KBNode with assistant API ID.`);
            setNodes((nds) => nds.map(n => {
                if (n.id === kbNode.id) {
                    return {...n, data: {...n.data, connectedAssistantId: assistantApiId }};
                }
                return n;
            }));
        }
    }
    // Default: For any other connections, just ensure the edge is added.
    // The initial addEdge call handles this, but you could add specific logic here if needed.

    scheduleAutoSave();
  }, [nodes, setNodes, setEdges, scheduleAutoSave, linkKnowledgeBaseToAssistant]);

  // Update node data
  const updateNodeData = useCallback((nodeId: string, dataToUpdate: Partial<any>) => {
    setNodes(nds => nds.map(node => {
      if (node.id === nodeId) {
        return { ...node, data: { ...node.data, ...dataToUpdate } };
      }
      return node;
    }));
    scheduleAutoSave();
  }, [setNodes, scheduleAutoSave]);

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
