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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

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
    if (!workflowId) return;

    try {
      setIsLoading(true);
      setSaveError(null);

      // Initialize a brand new canvas when creating
      if (workflowId === 'create') {
        const sanitized = sanitizeWorkflowData({ nodes: [], edges: [] });
        setWorkflow(null);
        setWorkflowName('Untitled Workflow');
        setIsPublished(false);
        setNodes(sanitized.nodes);
        setEdges(sanitized.edges);
        console.log('[Workflow] Initialized new workflow with nodes:', sanitized.nodes);
      } else {
        const data = await workflowApi.getWorkflow(workflowId, orgId);

        if (data) {
          setWorkflow(data);
          // Prefer workflowJson fields for name when present
          const wfName = (data as any)?.workflowJson?.name || data.name || 'Untitled Workflow';
          setWorkflowName(wfName);
          setIsPublished(data.isPublished || false);

          // Prefer unified workflowJson for graph + ui
          const wfJson = (data as any)?.workflowJson;
          if (wfJson && wfJson.graph) {
            const rawNodes = Array.isArray(wfJson.graph.nodes) ? wfJson.graph.nodes : [];
            const rawEdges = Array.isArray(wfJson.graph.edges) ? wfJson.graph.edges : [];
            const sanitizedData = sanitizeWorkflowData({ nodes: rawNodes, edges: rawEdges });
            setNodes(sanitizedData.nodes);
            setEdges(sanitizedData.edges);
            console.log('[Workflow] Loaded workflow from workflowJson.graph');

            // Viewport from wfJson.ui.viewport when present
            const vp = wfJson?.ui?.viewport;
            if (vp && typeof vp === 'object') {
              setViewport(vp);
            }
            // Initialize lastSavedAt from persisted metadata if present
            const lsa = wfJson?.ui?.lastSavedAt;
            if (lsa) {
              try {
                setLastSavedAt(new Date(lsa));
              } catch {}
            }
          } else {
            // Fallback to legacy nodes/edges fields
            const sanitizedData = sanitizeWorkflowData(data);
            setNodes(sanitizedData.nodes);
            setEdges(sanitizedData.edges);
            console.log('[Workflow] Loaded workflow from legacy nodes/edges');

            // Legacy viewport
            if ((data as any).viewport) {
              try {
                const viewportData = typeof (data as any).viewport === 'string'
                  ? JSON.parse((data as any).viewport)
                  : (data as any).viewport;
                setViewport(viewportData);
              } catch (err) {
                console.error('Error parsing viewport data:', err);
              }
            }
          }
        } else {
          // No data returned (e.g., 204/empty body). Initialize a fresh canvas with Start.
          const sanitized = sanitizeWorkflowData({ nodes: [], edges: [] });
          setWorkflow(null);
          setWorkflowName('Untitled Workflow');
          setIsPublished(false);
          setNodes(sanitized.nodes);
          setEdges(sanitized.edges);
          console.warn('[Workflow] No workflow data returned. Initialized new workflow with Start node.');
        }
      }
    } catch (error) {
      console.error('Error fetching workflow:', error);
      setSaveError('Failed to load workflow');
      // Fallback: still initialize a fresh canvas so the page remains usable
      const sanitized = sanitizeWorkflowData({ nodes: [], edges: [] });
      setWorkflow(null);
      setWorkflowName('Untitled Workflow');
      setIsPublished(false);
      setNodes(sanitized.nodes);
      setEdges(sanitized.edges);
      console.warn('[Workflow] Initialized fallback canvas with Start node due to fetch error.');
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

    // 1) Ensure a Start node exists; if not, add one with a stable id and position
    const hasStart = nodes.some((n) => n.type === AgentNodeType.START);
    if (!hasStart) {
      const startNode: FlowNode = {
        id: 'start',
        type: AgentNodeType.START,
        position: { x: 100, y: 100 },
        data: {
          id: 'start',
          nodeTitle: 'Start',
          blockNumber: 1,
        } as any,
      };
      nodes = [startNode, ...nodes];
    }

    // 2) Enforce non-deletable flag on any Start node present in persisted data
    nodes = nodes.map((n, idx) => ({
      ...n,
      data: { ...n.data, blockNumber: (n.data as any)?.blockNumber ?? idx + 1 },
    }));

    return { nodes, edges: uniqueEdges };
  };

  // Save workflow with current viewport state as unified workflowJson
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

      // Build connections map from edges (source -> out[])
      const connections: Record<string, { out: { nodeId: string; handleId?: string }[] }> = {};
      for (const e of edgesToSave) {
        if (!e.source || !e.target) continue;
        if (!connections[e.source]) connections[e.source] = { out: [] };
        connections[e.source].out.push({ nodeId: e.target, handleId: (e as any).targetHandle });
      }

      const nowIso = new Date().toISOString();
      const workflowJson = {
        id: workflowId,
        name: workflowName,
        description: (workflow as any)?.description ?? undefined,
        organizationId: orgId ?? (workflow as any)?.organizationId ?? undefined,
        status: (workflow as any)?.status ?? (isPublished ? 'published' : 'draft'),
        version: (workflow as any)?.version ?? undefined,
        publishedAt: (workflow as any)?.publishedAt ?? (isPublished ? nowIso : null),
        assistantId: (workflow as any)?.assistantId ?? undefined,
        modelDefaults: (workflow as any)?.modelDefaults ?? undefined,
        ui: {
          viewport: viewportToSave ?? undefined,
          lastOpenedAt: (workflow as any)?.ui?.lastOpenedAt ?? nowIso,
          lastSavedAt: nowIso,
        },
        graph: {
          nodes: nodesToSave,
          edges: edgesToSave,
          connections,
        },
      };

      console.log(`[Workflow] Saving workflow ${workflowId} with unified workflowJson`);
      await workflowApi.updateWorkflow(workflowId, { workflowJson }, orgId);
      const now = new Date();
      setLastSavedAt(now);
      setHasUnsavedChanges(false);
      console.log('Workflow saved successfully');
    } catch (error) {
      console.error('Error saving workflow:', error);
      setSaveError('Failed to save workflow');
    } finally {
      setIsSaving(false);
    }
  }, [workflowId, workflowName, nodes, edges, isLoading, isPublished, viewport, workflowApi, orgId, workflow]);

  // Schedule change tracking (no autosave). Update viewport and mark unsaved changes.
  const scheduleAutoSave = useCallback((currentViewport?: Viewport) => {
    if (workflowId && workflowId !== 'create') {
      if (currentViewport) {
        setViewport(currentViewport);
      }
      setHasUnsavedChanges(true);
    }
  }, [workflowId]);

  // Allow external callers to mark unsaved changes without triggering autosave
  const markUnsavedChanges = useCallback(() => {
    setHasUnsavedChanges(true);
  }, []);

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
    // Prevent removal of the Start node
    const filteredChanges = changes.filter((change) => {
      if (change.type !== 'remove') return true;
      const target = nodes.find((n) => n.id === change.id);
      return target?.type !== AgentNodeType.START;
    });

    // Special handling for node removal (to handle API cleanup for KB nodes)
    for (const change of filteredChanges) {
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

    setNodes((nds) => applyNodeChanges(filteredChanges, nds) as FlowNode[]);
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
      type: 'step',
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
                e.type === 'step'
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
                    e.type === 'step'
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
    hasUnsavedChanges,
    markUnsavedChanges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    updateNodeData,
    saveWorkflow,
    publishWorkflow,
    scheduleAutoSave
  };
}
