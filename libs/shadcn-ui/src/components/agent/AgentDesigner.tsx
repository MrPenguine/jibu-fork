"use client";

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  Background,
  useReactFlow,
  Node,
  Edge,
  Connection,
  NodeChange,
  EdgeChange,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  Panel,
  OnConnectEnd,
  Viewport,
  reconnectEdge // Added reconnectEdge import
} from 'reactflow';

import { toast, useToast } from '../../components/ui/use-toast';
import { useWorkflow } from '../../hooks/workflow';
import { AgentNodeType, AssistantNodeData, BaseNodeData, FlowNode, FlowEdge } from '../../types';
import { FlowNode as InspectorFlowNode } from '../../../../src'; // Import for Inspector compatibility
import { Button } from '../ui/button';
import { AgentPalette } from './AgentPalette';
import { edgeTypes, defaultEdgeOptions } from './constants';
import { AgentNodeInspector } from './AgentNodeInspector';
import { AssistantInspector } from './AssistantInspector';
import { AssistantConfigModal } from './AssistantConfigModal'; 
import { AssistantNodeData as NodeAssistantNodeData } from './nodes/AssistantNode'; 

// Import custom node components
import { StartNode } from './nodes/StartNode';
import { EndNode } from './nodes/EndNode';
import { MessageNode } from './nodes/MessageNode';
import { ChoiceNode } from './nodes/ChoiceNode';
import { ConditionNode } from './nodes/ConditionNode';
import { SetVariableNode } from './nodes/SetVariableNode';
import { ApiCallNode } from './nodes/ApiCallNode';
import { ToolCallNode } from './nodes/ToolCallNode';
import { AssistantNode } from './nodes/AssistantNode'; // Added import
import { KnowledgeBaseSearchNode } from './nodes/KnowledgeBaseSearchNode'; // Added KnowledgeBaseSearchNode import

// Define node types for React Flow
const nodeTypes: any = {
  [AgentNodeType.START]: StartNode,
  [AgentNodeType.END]: EndNode,
  [AgentNodeType.MESSAGE]: MessageNode,
  [AgentNodeType.CHOICE]: ChoiceNode,
  [AgentNodeType.CONDITION]: ConditionNode,
  [AgentNodeType.SET_VARIABLE]: SetVariableNode,
  [AgentNodeType.API_CALL]: ApiCallNode,
  [AgentNodeType.TOOL_CALL]: ToolCallNode,
  [AgentNodeType.ASSISTANT]: AssistantNode, // Added AssistantNode mapping
  [AgentNodeType.KNOWLEDGE_BASE_SEARCH]: KnowledgeBaseSearchNode, // Use enum member
};

// edgeTypes and defaultEdgeOptions are centralized in constants.ts

// Type definition for API client - will be provided by the parent component
export interface WorkflowApiClient {
  updateWorkflow: (workflowId: string, data: any, specificOrgId?: string) => Promise<any>;
  getWorkflow: (workflowId: string, specificOrgId?: string) => Promise<any>;
  publishWorkflow?: (workflowId: string, specificOrgId?: string) => Promise<any>;
}

export interface AgentDesignerProps {
  initialNodes?: FlowNode[];
  initialEdges?: FlowEdge[];
  onSave?: (nodes: FlowNode[], edges: FlowEdge[]) => void;
  assistantId?: string;
  readOnly?: boolean;
  workflowId?: string;
  autoSaveInterval?: number; // in milliseconds
  apiClient?: WorkflowApiClient; // API client for workflow operations
  organizationId?: string; // The organization ID for API calls
}

export const AgentDesigner: React.FC<AgentDesignerProps> = ({
  initialNodes = [],
  initialEdges = [],
  onSave,
  assistantId,
  readOnly = false,
  workflowId,
  autoSaveInterval = 5000, // Default to 5 seconds
  apiClient,
  organizationId,
}) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useRef<any>(null);

  // State for Assistant Configuration Modal
  const [isAssistantConfigModalOpen, setIsAssistantConfigModalOpen] = useState(false);
  const [editingAssistantNodeData, setEditingAssistantNodeData] = useState<AssistantNodeData | null>(null);
  
  // State for Assistant Inspector sidebar
  const [inspectingAssistantNode, setInspectingAssistantNode] = useState<FlowNode | null>(null);

  // Use the workflow hook for state management
  const {
    nodes,
    setNodes,
    edges,
    setEdges,
    isLoading,
    isSaving,
    saveError,
    lastSavedAt: lastSaved,
    onNodesChange,
    onEdgesChange,
    onConnect,
    updateNodeData,
    saveWorkflow,
    scheduleAutoSave,
    viewport,
    updateViewport
  } = useWorkflow(workflowId || '', apiClient, organizationId);

  // Track dirty state
  const [isDirty, setIsDirty] = useState(false);
  const [isNodeInspectorOpen, setIsNodeInspectorOpen] = useState(false);
  const { toast: toastFn } = useToast();

  // Storage keys for workspace data - ONLY use localStorage for existing workflows with IDs
  const workspaceStorageKey = useMemo(() => {
    // Only use localStorage for workflows with real IDs
    if (workflowId && workflowId !== 'create' && workflowId !== 'new') {
      return `workspace-${workflowId}`;
    }
    // Return null for new workflows to prevent localStorage use
    return null;
  }, [workflowId]);
  const workflowConfigStorageKey = useMemo(() => {
    if (workflowId && workflowId !== 'create' && workflowId !== 'new') {
      return `workflow-config-${workflowId}`;
    }
    return null;
  }, [workflowId]);

  // Initialize the designer with initial nodes and edges
  useEffect(() => {
    if (initialNodes.length > 0 || initialEdges.length > 0) {
      // Handle potential type incompatibilities between different FlowNode/FlowEdge definitions
      setNodes(initialNodes.map(node => ({
        ...node,
        type: node.type // Ensure type compatibility
      })) as any);
      setEdges(initialEdges as any);
    }
  }, [initialNodes, initialEdges, setNodes, setEdges]);


  // Handle node updates and track dirty state
  const onNodeUpdate = useCallback((nodeId: string, data: any) => {
    updateNodeData(nodeId, data);
    setIsDirty(true);
  }, [updateNodeData]);

  // Handle edge data updates and track dirty state
  const onEdgeUpdate = useCallback((edgeId: string, data: any) => {
    setEdges((eds) =>
      eds.map((edge) => {
        if (edge.id === edgeId) {
          return { ...edge, data: { ...edge.data, ...data } };
        }
        return edge;
      })
    );
    setIsDirty(true);
  }, [setEdges]);
  
  // Track edge reconnection state
  const edgeReconnectSuccessful = useRef(true);
  
  // Handle reconnection start
  const onReconnectStart = useCallback(() => {
    edgeReconnectSuccessful.current = false;
  }, []);

  // Handle reconnection
  const onReconnect = useCallback((oldEdge: Edge, newConnection: Connection) => {
    edgeReconnectSuccessful.current = true;
    setEdges((els) => reconnectEdge(oldEdge, newConnection, els) as FlowEdge[]);
    scheduleAutoSave();
  }, [setEdges, scheduleAutoSave]);

  // Handle reconnection end
  const onReconnectEnd = useCallback((_: any, edge: Edge) => {
    if (!edgeReconnectSuccessful.current) {
      setEdges((eds) => eds.filter((e) => e.id !== edge.id));
      scheduleAutoSave();
    }
    edgeReconnectSuccessful.current = true;
  }, [setEdges, scheduleAutoSave]);

  // Handle node click and highlight the selected node
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      console.log("[AgentDesigner] Node clicked:", node);
      setSelectedNode(node as FlowNode);
    },
    [setSelectedNode]
  );
  
  // Direct handler for node double-click
  const onNodeDoubleClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.stopPropagation();
      console.log("[AgentDesigner] Node double-clicked:", node);
      
      if (node.type === AgentNodeType.ASSISTANT) {
        console.log("[AgentDesigner] Opening Assistant Inspector for node:", node.id);
        setInspectingAssistantNode(node as FlowNode);
        setSelectedNode(null);
      }
    },
    [setInspectingAssistantNode, setSelectedNode]
  );
  
  // Function to save workflow with current viewport data
  const saveWorkspaceWithViewport = useCallback(() => {
    if (reactFlowInstance.current) {
      const currentViewport = reactFlowInstance.current.getViewport();
      updateViewport(currentViewport);
      saveWorkflow();
    } else {
      saveWorkflow();
    }
  }, [saveWorkflow, updateViewport, reactFlowInstance]);

  // Enable continuous autosaving when the component mounts
  useEffect(() => {
    // Set up autosaving on component mount
    if (!readOnly && workflowId && workflowId !== 'create' && workflowId !== 'new') {
      console.log(`[AgentDesigner] Enabling continuous autosave for workflow: ${workflowId}`);
      scheduleAutoSave();
    }
  }, [workflowId, readOnly, scheduleAutoSave]);
  
  // Add event handler for keypresses with command key (removing Ctrl+S as we're autosaving now)
  const handleKeyUp = useCallback((event: KeyboardEvent, rfInstance: any, isNodeInspectorOpen: boolean) => {
    // Keep empty handler for future keyboard shortcuts
    // We've removed the explicit save shortcut since we're autosaving now
    if ((event.metaKey || event.ctrlKey) && !isNodeInspectorOpen) {
      // We can add other keyboard shortcuts here in the future
    }
    
    // Handle Delete and Backspace keys to delete selected nodes
    if ((event.key === 'Delete' || event.key === 'Backspace') && selectedNode && !readOnly) {
      // Ignore if user is typing in an input field
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      console.log(`[AgentDesigner] Deleting node: ${selectedNode.id}`);
      
      // Remove the node
      setNodes((nds) => nds.filter(node => node.id !== selectedNode.id));
      
      // Remove any connected edges
      setEdges((eds) => eds.filter(edge => 
        edge.source !== selectedNode.id && edge.target !== selectedNode.id
      ));
      
      // Clear the selected node
      setSelectedNode(null);
      
      // Mark as dirty to trigger autosave
      setIsDirty(true);
      
      // Show toast notification
      toastFn({
        title: "Node Deleted",
        description: "The selected node has been removed.",
        duration: 2000,
      });
    }
  }, [saveWorkspaceWithViewport, readOnly, toast, selectedNode, setNodes, setEdges, setSelectedNode, setIsDirty]);
  
  // Create modified node/edge change handlers that also set dirty state
  const onNodesChangeWithDirty = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
      setIsDirty(true);
      scheduleAutoSave();
    },
    [onNodesChange, setIsDirty, scheduleAutoSave]
  );

  const onEdgesChangeWithDirty = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes);
      setIsDirty(true);
      scheduleAutoSave();
    },
    [onEdgesChange, setIsDirty, scheduleAutoSave]
  );
  
  // Viewport change handler
  const onViewportChange = useCallback(
    (event: any) => {
      if (reactFlowInstance.current) {
        const viewport = reactFlowInstance.current.getViewport();
        updateViewport(viewport);
        scheduleAutoSave();
      }
    },
    [reactFlowInstance, updateViewport, scheduleAutoSave]
  );
  
  // Enhanced connect handler for special edge types
  const onConnectWithSpecialEdges = useCallback(
    (connection: Connection) => {
      onConnect(connection);
      setIsDirty(true);
      scheduleAutoSave();
    },
    [onConnect, setIsDirty, scheduleAutoSave]
  );
  
  // Handlers for drag and drop functionality
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);
  
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!reactFlowWrapper.current || !reactFlowInstance.current) return;

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;

      const position = reactFlowInstance.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode = {
        id: `${type}-${Math.random().toString(16).slice(2, 8)}`,
        type,
        position,
        data: { label: type },
      } as FlowNode;

      setNodes((nds) => nds.concat(newNode));
      setIsDirty(true);
      scheduleAutoSave();
    },
    [reactFlowInstance, reactFlowWrapper, setNodes, setIsDirty, scheduleAutoSave]
  );
  
  // Handler for saving assistant configuration
  const handleSaveAssistantConfig = useCallback(
    (assistantData: AssistantNodeData) => {
      if (!editingAssistantNodeData) return;
      
      // Find the node being edited
      const nodeId = nodes.find(
        (n) => n.type === AgentNodeType.ASSISTANT && n.data === editingAssistantNodeData
      )?.id;
      
      if (nodeId) {
        // Update node data
        updateNodeData(nodeId, assistantData);
        setIsDirty(true);
        scheduleAutoSave();
        
        // Close the modal
        setIsAssistantConfigModalOpen(false);
        setEditingAssistantNodeData(null);
      }
    },
    [editingAssistantNodeData, nodes, updateNodeData, setIsDirty, scheduleAutoSave]
  );

  // Helper function to check if a node is an Assistant node
  const isAssistantNode = (node: FlowNode): boolean => {
    return node.type === AgentNodeType.ASSISTANT;
  };

  // Register event handlers
  useEffect(() => {
    const keyUpHandler = (event: KeyboardEvent) => handleKeyUp(event, reactFlowInstance.current, isNodeInspectorOpen);
    
    document.addEventListener('keyup', keyUpHandler);
    
    return () => {
      document.removeEventListener('keyup', keyUpHandler);
    };
  }, [handleKeyUp, reactFlowInstance, isNodeInspectorOpen]);
  
  // Helper for opening the Assistant Configuration Modal
  const handleOpenAssistantConfigModal = useCallback((node: FlowNode) => {
    if (isAssistantNode(node)) {
      setEditingAssistantNodeData(node.data as AssistantNodeData);
      setIsAssistantConfigModalOpen(true);
    }
  }, []);
  
  // Add edit handlers and double-click handlers to assistant nodes
  useEffect(() => {
    const needsHandlers = nodes.some(node => 
      node.type === AgentNodeType.ASSISTANT && (
        typeof (node.data as any).onEdit !== 'function' ||
        typeof (node.data as any).onNodeDoubleClick !== 'function'
      )
    );
    
    if (needsHandlers) {
      const nodesWithHandlers = nodes.map(node => {
        if (node.type === AgentNodeType.ASSISTANT) {
          const currentData: any = node.data || {};
          const ensureOnEdit = typeof currentData.onEdit === 'function' ? currentData.onEdit : () => handleOpenAssistantConfigModal(node);
          const ensureOnDbl = typeof currentData.onNodeDoubleClick === 'function' ? currentData.onNodeDoubleClick : (event: React.MouseEvent) => {
            event.stopPropagation();
            setInspectingAssistantNode(node);
            setSelectedNode(null); // Clear regular selection when opening assistant inspector
          };
          return {
            ...node,
            data: {
              ...currentData,
              onEdit: ensureOnEdit,
              onNodeDoubleClick: ensureOnDbl,
            }
          } as FlowNode;
        }
        return node;
      });
      
      setNodes(nodesWithHandlers);
    }
  }, [nodes, handleOpenAssistantConfigModal, setNodes, setInspectingAssistantNode, setSelectedNode]);

  // Add update handlers to edges
  useEffect(() => {
    const needsHandlers = edges.some(edge => typeof (edge.data as any)?.updateEdgeData !== 'function');
    if (needsHandlers) {
      const edgesWithHandlers = edges.map(edge => ({
        ...edge,
        data: {
          ...edge.data,
          updateEdgeData: onEdgeUpdate,
        },
      }));
      setEdges(edgesWithHandlers);
    }
  }, [edges, onEdgeUpdate, setEdges]);

  return (
    <div className="flex h-full w-full bg-background text-foreground" ref={reactFlowWrapper}>
      {/* ReactFlow container */}
      <div className="flex-grow h-full" data-testid="rf-wrapper">
        <ReactFlow
          ref={(instance) => {
            reactFlowInstance.current = instance;
          }}
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={onNodeDoubleClick}
          onPaneClick={() => {
            setSelectedNode(null);
            setInspectingAssistantNode(null);
          }}
          onReconnect={onReconnect}
          onReconnectStart={onReconnectStart}
          onReconnectEnd={onReconnectEnd}
          fitView
          attributionPosition="bottom-right"
          minZoom={0.1}
          maxZoom={2}
          defaultViewport={viewport || undefined}
          onMoveEnd={(event) => updateViewport(reactFlowInstance.current?.getViewport() || { x: 0, y: 0, zoom: 1 })}
          proOptions={{ hideAttribution: true }}
          deleteKeyCode={readOnly ? null : 'Delete'}
          multiSelectionKeyCode={null} // Disable multi-selection
        >
          <Controls />
          <Background />
          {!readOnly && (
            <Panel position="top-left">
              <AgentPalette />
            </Panel>
          )}
          <Panel position="top-right">
            <div className="flex items-center gap-2 p-2 bg-card border rounded-lg shadow">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  {isDirty && !isSaving && <span className="text-xs text-amber-500">Autosaving...</span>}
                  {isSaving && <span className="text-xs text-blue-500">Saving...</span>}
                  {!isSaving && !isDirty && !saveError && nodes.length > 0 && <span className="text-xs text-green-500">All changes saved</span>} 
                  {saveError && <span className="text-xs text-red-500">Error saving!</span>}
                </div>
                <div className="text-xs text-muted-foreground">
                  {lastSaved && `Last saved: ${lastSaved.toLocaleTimeString()}`}
                  {saveError && <div className="text-xs text-red-500 mt-1">{saveError}</div>}
                </div>
              </div>
            </div>
          </Panel>
        </ReactFlow>
      </div>
      
      {/* Inspector Panel */}
      {selectedNode && !isAssistantNode(selectedNode) && !readOnly && (
        <div className="w-80 border-l border-border p-4 overflow-y-auto bg-card">
          <AgentNodeInspector
            node={selectedNode as unknown as InspectorFlowNode}
            onUpdate={onNodeUpdate}
            assistantId={assistantId}
          />
        </div>
      )}
      
      {/* Assistant Inspector Panel */}
      {inspectingAssistantNode && !readOnly && (
        <div className="w-80 border-l border-border bg-white shadow-lg z-10">
          <div className="relative h-full">
            <Button 
              variant="ghost" 
              className="absolute top-2 right-2 z-20"
              onClick={() => setInspectingAssistantNode(null)}
            >
              ×
            </Button>
            <AssistantInspector
              node={inspectingAssistantNode as unknown as InspectorFlowNode}
              onUpdate={onNodeUpdate}
              onOpenAssistantConfig={(nodeId: string) => {
                const node = nodes.find(n => n.id === nodeId);
                if (!node || !isAssistantNode(node)) return;
                const data = node.data as AssistantNodeData;
                if (!data?.apiAssistantId) {
                  toastFn({
                    title: 'Select an assistant first',
                    description: 'Please choose an assistant from the dropdown before editing.',
                    duration: 2500,
                  });
                  return;
                }
                setEditingAssistantNodeData(data);
                setIsAssistantConfigModalOpen(true);
              }}
            />
          </div>
        </div>
      )}
      
      {/* Assistant Config Modal */}
      {isAssistantConfigModalOpen && editingAssistantNodeData && (
        <AssistantConfigModal
          open={isAssistantConfigModalOpen}
          onOpenChange={(open) => {
            if (!open) {
              setIsAssistantConfigModalOpen(false);
              setEditingAssistantNodeData(null);
            }
          }}
          assistantData={editingAssistantNodeData}
          onSave={handleSaveAssistantConfig}
        />
      )}
    </div>
  );
};

export const AgentDesignerWithProvider: React.FC<AgentDesignerProps> = (props) => {
  return (
    <ReactFlowProvider>
      <AgentDesigner {...props} />
    </ReactFlowProvider>
  );
};
