"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ReactFlow,
  ReactFlowProvider,
  NodeMouseHandler,
  Controls,
  Background,
  BackgroundVariant,
  useReactFlow,
  ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Button } from '@libs/shadcn-ui/components/ui/button';
import { useToast } from '@libs/shadcn-ui/components/ui/use-toast';
import {
  AgentNodeType,
  FlowNode,
  FlowEdge,
} from '@libs/shadcn-ui';
import {
  AssistantConfigModal,
} from '@libs/shadcn-ui/components/agent';
import { AssistantInspector } from '@libs/shadcn-ui/components/agent/AssistantInspector';
import {
  AgentExecutionDialog,
} from '@libs/shadcn-ui/components/agent';
import { nodeTypes, defaultEdgeOptions, edgeTypes } from '@libs/shadcn-ui/components/agent/constants';
// (icons now encapsulated within TopRightButtons)
import { TopRightButtons } from '@libs/shadcn-ui/components/agent/canvas/TopRightButtons';
import VersionHistoryModal, { VersionItem } from '@libs/shadcn-ui/components/agent/canvas/VersionHistoryModal';
import { ControlPanel } from '@libs/shadcn-ui/components/agent/canvas/ControlPanel';
import { TestAgentButton } from '@libs/shadcn-ui/components/agent/canvas/TestAgentButton';
import { ColorMenu } from '@libs/shadcn-ui/components/agent/canvas/ColorMenu';
import { EdgeContextMenu } from '@libs/shadcn-ui/components/agent/canvas/EdgeContextMenu';
import { NodeContextMenu } from '@libs/shadcn-ui/components/agent/canvas/NodeContextMenu';

// Import our custom hook and components
import { getDefaultNodeData } from '@libs/shadcn-ui/hooks/agent';
import { useWorkflow } from '@libs/shadcn-ui/hooks/workflow';
import { AgentSidebar as CanvasSidebar } from '@libs/shadcn-ui/components/agent/CanvasSidebar';
import { NodeInspectorPanel } from '@libs/shadcn-ui/components/agent';

// Import the workflow API client
import { workflowApi } from '../../../../../../utils/workflowApi';
// Import the agent API client for agent execution
import { agentApiClient } from '../../../../../../utils/AgentApi';
// Import the assistants API for fetching assistant data
import { getAssistant } from '../../../../../../utils/AssistantsApi';

// nodeTypes and defaultEdgeOptions are imported from shared constants

// Main agent editor component
function AgentCanvasContent() {
  const params = useParams();
  const agentId = params.agentId as string;
  const workflowId = params.workflowId as string;
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [, setAgent] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  
  // Use our custom hook for workflow management
  const {
    workflow,
    workflowName,
    setWorkflowName,
    nodes,
    setNodes,
    edges,
    isLoading: workflowLoading,
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
    scheduleAutoSave,
    setEdges: setWorkflowEdges
  } = useWorkflow(workflowId, workflowApi);

  // State for React Flow instance and active popover
  const { zoomIn, zoomOut, fitView: rfFitView, setViewport, setCenter } = useReactFlow();
  const [showGrid, setShowGrid] = useState(true);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [activePopover, setActivePopover] = useState<string | null>(null);
  const [isAssistantConfigOpen, setIsAssistantConfigOpen] = useState(false);
  const [selectedAssistantData, setSelectedAssistantData] = useState<any>(null);
  const [selectedAssistantNodeId, setSelectedAssistantNodeId] = useState<string | null>(null);
  const [isPublishingAgent, setIsPublishingAgent] = useState(false);
  // Version history modal state
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  const [versionItems, setVersionItems] = useState<VersionItem[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [versionsError, setVersionsError] = useState<string | null>(null);
  // Assistant inspector sidebar state
  const [inspectingAssistantNode, setInspectingAssistantNode] = useState<FlowNode | null>(null);
  // Guard to avoid duplicate client-side injection
  const startInjectedRef = useRef(false);
  // Run fitView only once after nodes are initially loaded
  const hasFittedRef = useRef(false);
  // Note placement mode
  const [isPlacingNote, setIsPlacingNote] = useState(false);
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number; type: 'node' | 'edge' | 'canvas' | null; nodeId?: string | null; edgeId?: string | null }>({ visible: false, x: 0, y: 0, type: null, nodeId: null, edgeId: null });
  const [colorMenu, setColorMenu] = useState<{ visible: boolean; x: number; y: number; kind?: 'node' | 'edge'; nodeId?: string | null; edgeId?: string | null }>({ visible: false, x: 0, y: 0, kind: undefined, nodeId: null, edgeId: null });
  const lastFlowClickPos = useRef<{ x: number; y: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const colorMenuRef = useRef<HTMLDivElement | null>(null);
  const [hue, setHue] = useState<number>(0);
  // Color swatches and active selection state
  const swatches = ['#94a3b8', '#60a5fa', '#86efac', '#fda4af', '#f59e0b']; // lighter slate first
  const [selectedSwatch, setSelectedSwatch] = useState<string>('#94a3b8');
  // Close menus on outside click / ESC
  useEffect(() => {
    const handleDown = (e: Event) => {
      if (!(contextMenu.visible || colorMenu.visible)) return;
      const target = e.target as Node | null;
      const ctxEl = contextMenuRef.current;
      const clrEl = colorMenuRef.current;
      const insideContext = !!(ctxEl && target && ctxEl.contains(target as Node));
      const insideColor = !!(clrEl && target && clrEl.contains(target as Node));
      if (insideContext || insideColor) return;
      setContextMenu({ visible: false, x: 0, y: 0, type: null, nodeId: null, edgeId: null });
      setColorMenu({ visible: false, x: 0, y: 0, kind: undefined, nodeId: null, edgeId: null });
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu({ visible: false, x: 0, y: 0, type: null, nodeId: null, edgeId: null });
        setColorMenu({ visible: false, x: 0, y: 0, kind: undefined, nodeId: null, edgeId: null });
      }
    };
    // Use capture-phase pointerdown so outside clicks are caught even if inner handlers stop propagation
    window.addEventListener('pointerdown', handleDown, { capture: true });
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('pointerdown', handleDown, { capture: true } as any);
      window.removeEventListener('keydown', handleKey);
    };
  }, [contextMenu.visible, colorMenu.visible]);

  // Global Delete key: delete selected nodes (except START) or selected edges; if none selected, delete the context edge
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Delete') return;
      // Avoid when typing in inputs/textarea/contenteditable
      const t = e.target as HTMLElement | null;
      const tag = (t?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || (t as any)?.isContentEditable) return;
      // Compute edges to delete first
      let deletedAny = false;
      setWorkflowEdges((eds: FlowEdge[]) => {
        const selectedEdgeIds = eds.filter((e: FlowEdge) => (e as any)?.selected).map((e: FlowEdge) => e.id);
        let idsToDelete = selectedEdgeIds;
        if (idsToDelete.length === 0 && contextMenu.type === 'edge' && contextMenu.edgeId) {
          idsToDelete = [contextMenu.edgeId];
        }
        if (idsToDelete.length === 0) return eds as any;
        deletedAny = true;
        return eds.filter((e: FlowEdge) => !idsToDelete.includes(e.id)) as any;
      });
      // Then compute nodes to delete: prefer multi-selected; fallback to selectedNode
      setNodes((nds) => {
        const selectedIds = nds.filter((n: any) => n?.selected).map(n => n.id);
        const fallbackId = selectedNode?.id ? [selectedNode.id] : [];
        let idsToDelete = (selectedIds.length ? selectedIds : fallbackId).filter((id) => {
          const n = nds.find(nn => nn.id === id);
          const typeStr = String(n?.type).toUpperCase();
          return typeStr !== 'START';
        });
        if (idsToDelete.length === 0 && !deletedAny) return nds as any;
        const filtered = nds.filter(n => !idsToDelete.includes(n.id));
        return filtered as any;
      });
      setSelectedNode(null);
      scheduleAutoSave();
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true } as any);
  }, [selectedNode, setNodes, setSelectedNode, scheduleAutoSave]);
  // Persist note edits coming from NoteNode custom event
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { id?: string; text?: string } | undefined;
      if (!detail?.id) return;
      updateNodeData(detail.id, { ...(nodes.find(n => n.id === detail.id)?.data as any), text: detail.text ?? '' });
      scheduleAutoSave();
    };
    window.addEventListener('note:changed', handler as EventListener);
    return () => window.removeEventListener('note:changed', handler as EventListener);
  }, [nodes, updateNodeData, scheduleAutoSave]);

  // Autosave after edge label commits from custom edge
  useEffect(() => {
    const onEdgeLabelSaved = () => {
      scheduleAutoSave();
    };
    window.addEventListener('edge:labelSaved', onEdgeLabelSaved as EventListener);
    return () => window.removeEventListener('edge:labelSaved', onEdgeLabelSaved as EventListener);
  }, [scheduleAutoSave]);

  // Persist note style (size/rotation/font) updates and adjust position when resizing from left/top
  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail as { id?: string; width?: number; height?: number; rotation?: number; fontSize?: number; offsetX?: number; offsetY?: number } | undefined;
      if (!d?.id) return;
      const nodeIndex = nodes.findIndex(n => n.id === d.id);
      if (nodeIndex === -1) return;

      const current = nodes[nodeIndex];
      const prevData = current.data as any;

      // Convert screen-space offset to flow-space using current zoom
      const zoom = (reactFlowInstance && (reactFlowInstance as any).getZoom) ? (reactFlowInstance as any).getZoom() : 1;
      const dx = (d.offsetX ?? 0) / (zoom || 1);
      const dy = (d.offsetY ?? 0) / (zoom || 1);

      // Update size/rotation/font
      updateNodeData(d.id, { ...prevData, width: d.width, height: d.height, rotation: d.rotation, fontSize: d.fontSize });

      // Apply positional shift for left/top resize so the stationary edge feels correct
      if (dx !== 0 || dy !== 0) {
        setNodes((nds) => nds.map(n => n.id !== d.id ? n : ({
          ...n,
          position: {
            x: (n.position?.x ?? 0) + dx,
            y: (n.position?.y ?? 0) + dy,
          },
        } as any)));
      }

      scheduleAutoSave();
    };
    window.addEventListener('note:style', handler as EventListener);
    return () => window.removeEventListener('note:style', handler as EventListener);
  }, [nodes, updateNodeData, scheduleAutoSave, setNodes, reactFlowInstance]);
  
  // Auto-fit view once when nodes first load so Start node is visible
  useEffect(() => {
    if (!reactFlowInstance) return;
    if (nodes && nodes.length > 0 && !hasFittedRef.current) {
      try {
        rfFitView({ padding: 0.2 });
        hasFittedRef.current = true;
      } catch (e) {
        console.warn('fitView failed:', e);
      }
    }
  }, [nodes, reactFlowInstance, rfFitView]);

  // Reset fit flag when workflow changes
  useEffect(() => {
    hasFittedRef.current = false;
  }, [workflowId]);

  // Debug: log nodes on change and inject Start if nothing loaded after an error/new canvas
  useEffect(() => {
    console.log('[Canvas] nodes state:', nodes);
    if (startInjectedRef.current) return;
    if (workflowLoading) return;
    if (nodes && nodes.length > 0) return;
    if (!reactFlowInstance || !reactFlowWrapper.current) return; // wait until instance and wrapper are ready

    // Schedule to ensure layout is settled
    requestAnimationFrame(() => {
      const bounds = reactFlowWrapper.current!.getBoundingClientRect();
      const center = reactFlowInstance.project({ x: bounds.width / 2, y: bounds.height / 2 });
      const position = { x: center.x - 50, y: center.y - 20 };

      const startNode: FlowNode = {
        id: 'start',
        type: AgentNodeType.START,
        position,
        data: { id: 'start', nodeTitle: 'Start', blockNumber: 1 } as any,
      };
      setNodes([startNode]);
      startInjectedRef.current = true;
      console.warn('[Canvas] Injected fallback Start node at center');
    });
  }, [nodes, workflowLoading, setNodes, reactFlowInstance]);

  // If only Start node exists and hasn't been moved, center it once on screen
  const startCenteredRef = useRef(false);
  useEffect(() => {
    if (startCenteredRef.current) return;
    if (!reactFlowInstance || !reactFlowWrapper.current) return;
    if (!nodes || nodes.length !== 1) return;
    const n = nodes[0];
    const typeStr = String(n.type).toUpperCase();
    const isStartType = typeStr === 'START';
    if (!isStartType) return;

    // Schedule after layout so wrapper bounds are accurate
    requestAnimationFrame(() => {
      const bounds = reactFlowWrapper.current!.getBoundingClientRect();
      const center = reactFlowInstance.project({ x: bounds.width / 2, y: bounds.height / 2 });
      const pos = { x: center.x - 50, y: center.y - 20 };
      if (Math.abs((n.position?.x ?? 0) - pos.x) > 1 || Math.abs((n.position?.y ?? 0) - pos.y) > 1) {
        setNodes([{ ...n, position: pos } as FlowNode]);
        // Optionally refit once for consistent zoom
        try { rfFitView({ padding: 0.2 }); } catch {}
        console.log('[Canvas] Centered lone Start node');
      }
      startCenteredRef.current = true;
    });
  }, [nodes, reactFlowInstance, setNodes]);

  // Helper to load versions (used on open and after actions)
  const loadVersions = useCallback(async () => {
    try {
      setLoadingVersions(true);
      setVersionsError(null);
      const list = await workflowApi.getWorkflowVersions(workflowId);
      const items: VersionItem[] = (list || []).map((v: any) => ({
        id: String(v.version ?? v.id ?? ''),
        timestamp: v.publishedAt || v.updatedAt || v.createdAt,
        status: (v.status === 'published') ? 'live' : 'draft',
        title: (v.status === 'published') ? `Published v${v.version}` : `Draft v${v.version}`,
      }));
      setVersionItems(items);
    } catch (e: any) {
      console.error('Failed to load workflow versions:', e);
      setVersionsError(e?.message || 'Failed to load versions');
    } finally {
      setLoadingVersions(false);
    }
  }, [workflowApi, workflowId]);

  // Load versions when the modal opens
  useEffect(() => {
    if (!isVersionHistoryOpen) return;
    loadVersions();
  }, [isVersionHistoryOpen, loadVersions]);

  // Restore a selected version into the main canvas (creates a new working copy until saved)
  const handleRestoreVersion = useCallback(async (v: VersionItem) => {
    try {
      const versionNumber = parseInt(String(v.id), 10);
      if (!Number.isFinite(versionNumber)) return;
      const detail = await workflowApi.getWorkflowVersion(workflowId, versionNumber);
      const wfJson: any = (detail as any)?.workflowJson;
      const graph = wfJson?.graph || {};
      const rawNodes = Array.isArray(graph.nodes) ? graph.nodes : [];
      const rawEdges = Array.isArray(graph.edges) ? graph.edges : [];
      // Apply to main canvas
      setNodes(rawNodes as any);
      setWorkflowEdges(rawEdges as any);
      // Viewport restore
      const vp = wfJson?.ui?.viewport && typeof wfJson.ui.viewport === 'object' ? wfJson.ui.viewport : null;
      if (vp) {
        try { setViewport(vp); } catch {}
        updateViewport(vp);
      } else {
        try { rfFitView({ padding: 0.2 }); } catch {}
      }
      // Mark as unsaved so user can Save to persist as a new version
      markUnsavedChanges();
      // Close modal after restore for clarity
      setIsVersionHistoryOpen(false);
      // Optionally refresh versions list (no-op until saved creates a new version)
      // await loadVersions();
    } catch (e) {
      console.error('Failed to restore version:', e);
    }
  }, [workflowApi, workflowId, setNodes, setWorkflowEdges, setViewport, updateViewport, rfFitView, markUnsavedChanges]);

  // Fetch agent details
  useEffect(() => {
    const fetchAgentDetails = async () => {
      if (!agentId) {
        router.push('/workspace');
        return;
      }

      try {
        setIsLoading(true);
        const agentData = await agentApiClient.getAgentDefinition(agentId);
        setAgent(agentData);
      } catch (error) {
        console.error("Failed to fetch agent details:", error);
        // Get the active organization ID from localStorage
        const orgId = localStorage.getItem('activeOrganizationId') || '';
        // Redirect to agents page if there's an error
        router.push(`/workspace/${orgId}/agents`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAgentDetails();
  }, [agentId, router]);
  
  // Node click handler
  const onNodeClick: NodeMouseHandler = useCallback((event, node) => {
    setSelectedNode(node as FlowNode);
  }, [setSelectedNode]);

  // Right-click on node: open context menu
  const onNodeContextMenu: NodeMouseHandler = useCallback((event, node) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ visible: true, x: event.clientX, y: event.clientY, type: 'node', nodeId: node.id });
    setColorMenu({ visible: false, x: 0, y: 0, kind: undefined, nodeId: null, edgeId: null });
    setSelectedNode(node as FlowNode);
  }, [setSelectedNode]);

  // ReactFlow-level double-click handler
  const onNodeDoubleClick: NodeMouseHandler = useCallback((event, node) => {
    if (node.type === AgentNodeType.ASSISTANT) {
      event.stopPropagation();
      setInspectingAssistantNode(node as FlowNode);
      setSelectedNode(null);
    }
  }, [setInspectingAssistantNode, setSelectedNode]);

  // Drag over handler for drag and drop
  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Test node handler
  const handleTestNode = useCallback((nodeId: string) => {
    // Find the node
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      setSelectedNode(node as FlowNode);
      setIsRunDialogOpen(true);
    }
  }, [nodes, setSelectedNode, setIsRunDialogOpen]);

  // Create a ref to track if a modal is already open to prevent duplicate API calls
  const isModalOpenRef = useRef(false);

  // Function to handle opening assistant config modal with debounce
  const handleOpenAssistantConfigModal = useCallback((event: React.MouseEvent, nodeId: string) => {
    console.log(`[WorkflowPage] Opening assistant config modal for node: ${nodeId}`);
    
    // Prevent duplicate calls if modal is already being opened
    if (isModalOpenRef.current) {
      console.log('[WorkflowPage] Modal already opening, ignoring duplicate call');
      return;
    }
    
    // Set flag to prevent duplicate calls
    isModalOpenRef.current = true;
    
    // Reset flag after a short delay
    setTimeout(() => {
      isModalOpenRef.current = false;
    }, 1000);
    
    // Close any open sidebars before opening modal
    setSelectedNode(null);
    setInspectingAssistantNode(null);
    
    // Find the node by ID
    const node = nodes.find(n => n.id === nodeId);
    
    if (!node) {
      console.warn(`[WorkflowPage] Node not found: ${nodeId}`);
      return;
    }
    
    console.log(`[WorkflowPage] Node data:`, node.data);
    
    // Set the assistant node ID (do not set selectedNode to avoid showing NodeInspectorPanel)
    setSelectedAssistantNodeId(nodeId);
    
    // Cast node.data to AssistantNodeData to access assistant-specific properties
    const nodeData = node.data as any;
    
    // Get the apiAssistantId from the node data
    const apiAssistantId = nodeData.apiAssistantId;
    
    if (apiAssistantId) {
      console.log(`[WorkflowPage] Found apiAssistantId: ${apiAssistantId}, fetching fresh data from API`);
      
      // Use a single API call instead of potentially triggering multiple
      getAssistant(apiAssistantId)
        .then(assistant => {
          if (!assistant || !assistant.id) {
            console.error(`[WorkflowPage] Received invalid assistant data from API:`, assistant);
            throw new Error('Received invalid assistant data from API');
          }
          
          console.log(`[WorkflowPage] Successfully fetched assistant data:`, JSON.stringify(assistant, null, 2));
          
          // Prepare the assistant data for the modal with the fresh API data
          const assistantData = {
            id: assistant.id,
            apiAssistantId: apiAssistantId,
            name: assistant.name || nodeData.name || 'New Assistant',
            systemMessage: assistant.voicemailMessage || nodeData.systemMessage || '',
            firstMessage: assistant.firstMessage || nodeData.firstMessage || '',
            knowledgeBaseId: assistant.knowledgeBaseId || nodeData.knowledgeBaseId || '',
            model: assistant.model || nodeData.model || { model: 'gpt-4-turbo', provider: 'openai', temperature: 0.7, maxTokens: 2048 }
          };
          
          console.log(`[WorkflowPage] Prepared assistant data for modal with API data:`, JSON.stringify(assistantData, null, 2));
          
          // Set the selected assistant data and open the modal
          setSelectedAssistantData(assistantData);
          setIsAssistantConfigOpen(true);
        })
        .catch(err => {
          console.error(`[WorkflowPage] Error fetching assistant data:`, err);
          
          // Fallback to using the node data if API fetch fails
          const assistantData = {
            id: nodeData.id || '',
            apiAssistantId: apiAssistantId,
            name: nodeData.name || 'New Assistant',
            systemMessage: nodeData.systemMessage || '',
            firstMessage: nodeData.firstMessage || '',
            knowledgeBaseId: nodeData.knowledgeBaseId || '',
            model: nodeData.model || { model: 'gpt-4-turbo', provider: 'openai', temperature: 0.7, maxTokens: 2048 }
          };
          
          console.log(`[WorkflowPage] Falling back to node data for modal:`, JSON.stringify(assistantData, null, 2));
          
          // Set the selected assistant data and open the modal
          setSelectedAssistantData(assistantData);
          setIsAssistantConfigOpen(true);
        });
    } else {
      console.log(`[WorkflowPage] No apiAssistantId found, using node data`);
      
      // Prepare the assistant data for the modal using just the node data
      const assistantData = {
        id: nodeData.id || '',
        apiAssistantId: '',
        name: nodeData.name || 'New Assistant',
        // Use nodeData for these properties
        systemMessage: nodeData.systemMessage || '',
        firstMessage: nodeData.firstMessage || '',
        knowledgeBaseId: nodeData.knowledgeBaseId || '',
        // Ensure we have the model object with all required fields
        model: nodeData.model || {
          provider: nodeData.model?.provider || 'openai',
          model: nodeData.model?.model || 'gpt-4-turbo',
          temperature: nodeData.model?.temperature ?? 0.7,
          maxTokens: nodeData.model?.maxTokens ?? 2048,
          preference: nodeData.model?.preference || 'balance'
        }
      };
      
      console.log(`[WorkflowPage] Setting assistant data for config modal:`, JSON.stringify(assistantData, null, 2));
      
      setSelectedAssistantData(assistantData);
      setSelectedAssistantNodeId(nodeId);
      setIsAssistantConfigOpen(true);
    }
  }, [nodes, setSelectedNode, getAssistant]);

  // Ensure Assistant nodes have a working onNodeDoubleClick in their data (for the Configure button inside the node)
  useEffect(() => {
    if (!nodes || nodes.length === 0) return;
    const needsUpdate = nodes.some(n => n.type === AgentNodeType.ASSISTANT && typeof (n.data as any).onNodeDoubleClick !== 'function');
    if (!needsUpdate) return;
    const updated = nodes.map(n => {
      if (n.type !== AgentNodeType.ASSISTANT) return n as FlowNode;
      const data: any = n.data || {};
      return {
        ...n,
        data: {
          ...data,
          onNodeDoubleClick: (evt: React.MouseEvent) => {
            evt.stopPropagation();
            setInspectingAssistantNode(n as FlowNode);
            setSelectedNode(null);
          },
        },
      } as FlowNode;
    });
    setNodes(updated as any);
  }, [nodes, setNodes, setInspectingAssistantNode, setSelectedNode]);

  // Handle assistant config save
  const handleAssistantConfigSave = useCallback((assistantData: any) => {
    console.log(`[WorkflowPage] Saving assistant config:`, JSON.stringify(assistantData, null, 2));
    
    if (!selectedAssistantNodeId) {
      console.error(`[WorkflowPage] No selected assistant node ID`);
      return;
    }
    
    // Update the node data with the new assistant data
    updateNodeData(selectedAssistantNodeId, {
      ...assistantData,
      type: AgentNodeType.ASSISTANT,
    });
    
    // Close the modal
    setIsAssistantConfigOpen(false);
    setSelectedAssistantData(null);
    setSelectedAssistantNodeId(null);
    
    // Schedule an auto-save
    scheduleAutoSave();
  }, [selectedAssistantNodeId, updateNodeData, scheduleAutoSave]);

  // Render the workflow editor
  return (
    <div className="h-screen w-full bg-white overflow-hidden" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 }}>
      {/* Main flow area - full screen */}
      <div className="h-full w-full" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes as any}
          defaultEdgeOptions={defaultEdgeOptions}
          onInit={setReactFlowInstance}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={onNodeDoubleClick}
          onNodeContextMenu={onNodeContextMenu}
          onEdgeContextMenu={(event, edge) => {
            event.preventDefault();
            event.stopPropagation();
            setContextMenu({ visible: true, x: event.clientX, y: event.clientY, type: 'edge', edgeId: edge.id });
            setColorMenu({ visible: false, x: 0, y: 0, kind: undefined, nodeId: null, edgeId: null });
          }}
          onDragOver={onDragOver}
          onPaneContextMenu={(event: React.MouseEvent) => {
            event.preventDefault();
            setColorMenu({ visible: false, x: 0, y: 0, kind: undefined, nodeId: null, edgeId: null });
            if (!reactFlowInstance || !reactFlowWrapper.current) return;
            const bounds = reactFlowWrapper.current.getBoundingClientRect();
            const flowPos = reactFlowInstance.project({ x: event.clientX - bounds.left, y: event.clientY - bounds.top });
            lastFlowClickPos.current = flowPos;
            setContextMenu({ visible: true, x: event.clientX, y: event.clientY, type: 'canvas', nodeId: null });
          }}
          nodesDraggable={true}
          panOnDrag={[0, 1]}
          onPaneClick={(event: React.MouseEvent) => {
            if (!isPlacingNote) return;
            event.preventDefault();
            if (!reactFlowInstance || !reactFlowWrapper.current) return;
            const bounds = reactFlowWrapper.current.getBoundingClientRect();
            const position = reactFlowInstance.project({
              x: event.clientX - bounds.left,
              y: event.clientY - bounds.top,
            });
            const newNode: FlowNode = {
              id: `note-${Date.now()}`,
              type: AgentNodeType.NOTE,
              position,
              data: { text: '', width: 224, height: 128, rotation: 0, fontSize: 14 },
            } as any;
            setNodes((nds) => [...nds, newNode]);
            setIsPlacingNote(false);
            scheduleAutoSave();
          }}
          onDrop={(event) => {
            event.preventDefault();
            
            if (!reactFlowInstance || !reactFlowWrapper.current) return;
            
            // Get the drop position in the canvas
            const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
            const position = reactFlowInstance.project({
              x: event.clientX - reactFlowBounds.left,
              y: event.clientY - reactFlowBounds.top,
            });
            
            try {
              // Get the transferred data
              const dataStr = event.dataTransfer.getData('application/reactflow');
              if (!dataStr || dataStr.trim() === '') {
                console.warn('No drag data found');
                return;
              }
              
              let dragData;
              try {
                dragData = JSON.parse(dataStr);
              } catch (parseError) {
                console.error('Failed to parse drag data:', parseError, 'Data:', dataStr);
                return;
              }
              
              const { type, data } = dragData;
              if (!type) {
                console.warn('No node type found in drag data');
                return;
              }
              
              // Create a new node with the dropped data
              const newNode = {
                id: `${type}-${Date.now()}`,
                type,
                position,
                data: data || getDefaultNodeData(type),
              };
              
              // Add the node to the flow
              setNodes((nds) => [...nds, newNode as FlowNode]);
              
              // Schedule an auto-save
              scheduleAutoSave();
            } catch (error) {
              console.error('Error handling node drop:', error);
            }
          }}
        >
          {showGrid && (
            <Background
              variant={BackgroundVariant.Dots}
              gap={16}
              size={1}
              color="#64748b"
            />
          )}
          <Controls />
          
          {/* Top-right action buttons */}
          <TopRightButtons
            onRun={() => setIsRunDialogOpen(true)}
            onPublish={async () => {
              const result = await publishWorkflow();
              if (!result && saveError) {
                toast({
                  title: "Cannot Publish Workflow",
                  description: saveError,
                  variant: "destructive",
                });
              }
            }}
            isPublishing={isPublishingAgent}
            isSaving={isSaving}
            isPublished={isPublished}
            hasDraft={workflow?.hasDraft}
            onOpenVersionHistory={() => setIsVersionHistoryOpen(true)}
            onSave={() => saveWorkflow()}
            hasUnsavedChanges={!!hasUnsavedChanges}
            lastSavedAt={lastSavedAt}
          />

          {/* Bottom-left control panel */}
          <ControlPanel
            onZoomOut={() => zoomOut()}
            onZoomIn={() => zoomIn()}
            onFitView={() => rfFitView({ padding: 0.2 })}
            onReset={() => setViewport({ x: 0, y: 0, zoom: 1 })}
            onToggleGrid={() => setShowGrid((v) => !v)}
            onToggleNoteMode={() => setIsPlacingNote((v) => !v)}
          />

          {/* Bottom-right test agent button */}
          <TestAgentButton onClick={() => setIsRunDialogOpen(true)} />
          
          {/* Floating sidebar for node palette */}
          <CanvasSidebar
            onDragStart={(event: React.DragEvent<HTMLDivElement>, nodeType: string, data?: any) => {
              // Set data for drag operation
              event.dataTransfer.setData('application/reactflow', JSON.stringify({
                type: nodeType,
                data: data
              }));
              event.dataTransfer.effectAllowed = 'move';
            }}
            activePopover={activePopover}
            setActivePopover={setActivePopover}
          />
        </ReactFlow>
        {/* Version History Modal */}
        <VersionHistoryModal
          open={isVersionHistoryOpen}
          onClose={() => setIsVersionHistoryOpen(false)}
          versions={versionItems}
          currentVersionId={(workflow as any)?.version ?? (workflow as any)?.workflowJson?.version}
          loadVersionDetail={async (v) => {
            // Return detail for read-only preview without applying to canvas
            try {
              const versionNumber = parseInt(String(v.id), 10);
              if (!Number.isFinite(versionNumber)) {
                return { nodes: [], edges: [], viewport: null };
              }
              const detail = await workflowApi.getWorkflowVersion(workflowId, versionNumber);
              const wfJson: any = (detail as any)?.workflowJson;
              if (wfJson?.graph) {
                const rawNodes = Array.isArray(wfJson.graph.nodes) ? wfJson.graph.nodes : [];
                const rawEdges = Array.isArray(wfJson.graph.edges) ? wfJson.graph.edges : [];
                const vp = wfJson?.ui?.viewport && typeof wfJson?.ui?.viewport === 'object' ? wfJson.ui.viewport : null;
                return { nodes: rawNodes as any[], edges: rawEdges as any[], viewport: vp };
              }
            } catch (e) {
              console.error('Failed to load version detail for preview:', e);
            }
            return { nodes: [], edges: [], viewport: null };
          }}
          onRestore={handleRestoreVersion}
        />
        
        {/* Context Menus */}
        {contextMenu.visible && (
          <div
            className="absolute bg-white border border-gray-200 rounded-md shadow-lg z-50 text-sm select-none"
            style={{ left: contextMenu.x, top: contextMenu.y, minWidth: 200 }}
            ref={contextMenuRef}
          >
            {contextMenu.type === 'node' && (
              <NodeContextMenu
                contextMenu={{
                  visible: true,
                  x: contextMenu.x,
                  y: contextMenu.y,
                  type: 'node',
                  nodeId: contextMenu.nodeId as string,
                }}
                setContextMenu={setContextMenu as any}
                nodes={nodes as any}
                setNodes={setNodes as any}
                setSelectedNode={setSelectedNode as any}
                setColorMenu={setColorMenu as any}
                setSelectedSwatch={setSelectedSwatch}
                scheduleAutoSave={scheduleAutoSave}
              />
            )}
            {contextMenu.type === 'canvas' && (
              <div className="py-1">
                <button
                  className="w-full text-left px-3 py-2 hover:bg-gray-100"
                  onClick={() => {
                    if (!lastFlowClickPos.current) return;
                    const pos = lastFlowClickPos.current;
                    const newNode: FlowNode = { id: `trigger-${Date.now()}`, type: 'TRIGGER' as any, position: pos, data: {} as any };
                    setNodes((nds) => [...nds, newNode]);
                    scheduleAutoSave();
                    setContextMenu({ visible: false, x: 0, y: 0, type: null });
                  }}
                >Add Trigger</button>
                <button
                  className="w-full text-left px-3 py-2 hover:bg-gray-100"
                  onClick={() => {
                    if (!lastFlowClickPos.current) return;
                    const pos = lastFlowClickPos.current;
                    const newNode: FlowNode = { id: `note-${Date.now()}`, type: AgentNodeType.NOTE, position: pos, data: { text: '', width: 224, height: 128, rotation: 0, fontSize: 14 } as any };
                    setNodes((nds) => [...nds, newNode]);
                    scheduleAutoSave();
                    setContextMenu({ visible: false, x: 0, y: 0, type: null });
                  }}
                >Add Note</button>
                <button
                  className="w-full text-left px-3 py-2 hover:bg-gray-100"
                  onClick={() => {
                    const start = nodes.find(n => String(n.type).toUpperCase() === 'START' || n.id === 'start');
                    if (start) {
                      try {
                        setCenter(start.position?.x ?? 0, start.position?.y ?? 0, { zoom: 1.2, duration: 300 });
                      } catch {
                        rfFitView({ padding: 0.2 });
                      }
                    }
                    setContextMenu({ visible: false, x: 0, y: 0, type: null });
                  }}
                >Return to Start</button>
              </div>
            )}
            {contextMenu.type === 'edge' && (
              <EdgeContextMenu
                contextMenu={{ visible: true, x: contextMenu.x, y: contextMenu.y, type: 'edge', edgeId: contextMenu.edgeId as string }}
                setContextMenu={setContextMenu as any}
                edges={edges as any}
                setEdges={setWorkflowEdges as any}
                setColorMenu={setColorMenu as any}
                setSelectedSwatch={setSelectedSwatch}
                scheduleAutoSave={scheduleAutoSave}
              />
            )}
          </div>
        )}
        {colorMenu.visible && (
          <ColorMenu
            state={colorMenu}
            setState={setColorMenu as any}
            hue={hue}
            setHue={setHue}
            swatches={swatches}
            selectedSwatch={selectedSwatch}
            setSelectedSwatch={setSelectedSwatch}
            nodes={nodes as any}
            setNodes={setNodes as any}
            setEdges={setWorkflowEdges as any}
            updateNodeData={updateNodeData}
            scheduleAutoSave={scheduleAutoSave}
            colorMenuRef={colorMenuRef}
          />
        )}
      </div>
        
      {/* Node inspector panel */}
      {selectedNode && (
        <NodeInspectorPanel
          selectedNode={selectedNode}
          onNodeUpdate={(nodeId: string, data: any) => {
            updateNodeData(nodeId, data);
            scheduleAutoSave();
          }}
          onClose={() => setSelectedNode(null)}
          assistantId={agentId}
        />
      )}

      {/* Assistant Inspector sidebar */}
      {inspectingAssistantNode && (
        <div className="w-80 border-l border-border bg-white shadow-lg z-10" style={{ position: 'absolute', top: 0, right: 0, bottom: 0 }}>
          <div className="relative h-full">
            <Button
              variant="ghost"
              className="absolute top-2 right-2 z-20"
              onClick={() => setInspectingAssistantNode(null)}
            >
              ×
            </Button>
            <AssistantInspector
              node={inspectingAssistantNode as any}
              onUpdate={(nodeId: string, data: any) => {
                updateNodeData(nodeId, data);
                scheduleAutoSave();
              }}
              onOpenAssistantConfig={(nodeId: string, e?: React.MouseEvent) => handleOpenAssistantConfigModal((e as any) || ({} as React.MouseEvent), nodeId)}
            />
          </div>
        </div>
      )}
      
      {/* Assistant config modal */}
      <AssistantConfigModal
        open={isAssistantConfigOpen}
        onOpenChange={setIsAssistantConfigOpen}
        assistantData={selectedAssistantData}
        onSave={handleAssistantConfigSave}
      />
      
      {/* Agent execution dialog */}
      <AgentExecutionDialog
        isOpen={isRunDialogOpen}
        onClose={() => setIsRunDialogOpen(false)}
        agentId={agentId}
        agentApi={agentApiClient}
        workflowId={workflowId}
      />
    </div>
  );
}

// Wrap the component with ReactFlowProvider
export default function AgentCanvasPage() {
  return (
    <ReactFlowProvider>
      <AgentCanvasContent />
    </ReactFlowProvider>
  );
}
