"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ReactFlow,
  ReactFlowProvider,
  NodeMouseHandler,
  Connection,
  Controls,
  Background,
  BackgroundVariant,
  useReactFlow,
  ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Input } from '@libs/shadcn-ui/components/ui/input';
import { Button } from '@libs/shadcn-ui/components/ui/button';
import { Separator } from '@libs/shadcn-ui/components/ui/separator';
import { Dialog, DialogContent } from '@libs/shadcn-ui/components/ui/dialog';
import {
  AgentNodeType,
  FlowNode,
  FlowEdge,
} from '@libs/shadcn-ui';
import {
  AssistantConfigModal,
} from '@libs/shadcn-ui/components/agent';
import { AssistantInspector } from '@libs/shadcn-ui/components/agent/AssistantInspector';
import { AgentNavSidebar } from '@libs/shadcn-ui/components/agent/AgentNavSidebar';
import {
  AgentExecutionDialog,
  AgentNodeInspector,
} from '@libs/shadcn-ui/components/agent';
import { nodeTypes, defaultEdgeOptions } from '@libs/shadcn-ui/components/agent/constants';
// (icons now encapsulated within TopRightButtons)
import { TopRightButtons } from '@libs/shadcn-ui/components/agent/canvas/TopRightButtons';
import { ControlPanel } from '@libs/shadcn-ui/components/agent/canvas/ControlPanel';
import { TestAgentButton } from '@libs/shadcn-ui/components/agent/canvas/TestAgentButton';

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
// Import UI toast component for notifications
import { toast } from '@libs/shadcn-ui/components/ui/use-toast';

// nodeTypes and defaultEdgeOptions are imported from shared constants

// Main agent editor component
function AgentCanvasContent() {
  const params = useParams();
  const agentId = params.agentId as string;
  const workflowId = params.workflowId as string;
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { fitView } = useReactFlow();
  const router = useRouter();
  const [agent, setAgent] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
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
    onNodesChange,
    onEdgesChange,
    onConnect,
    updateNodeData,
    saveWorkflow,
    publishWorkflow,
    scheduleAutoSave
  } = useWorkflow(workflowId, workflowApi);

  // State for React Flow instance and active popover
  const { zoomIn, zoomOut, fitView: rfFitView, setViewport } = useReactFlow();
  const [showGrid, setShowGrid] = useState(true);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [activePopover, setActivePopover] = useState<string | null>(null);
  const [isAssistantConfigOpen, setIsAssistantConfigOpen] = useState(false);
  const [selectedAssistantData, setSelectedAssistantData] = useState<any>(null);
  const [selectedAssistantNodeId, setSelectedAssistantNodeId] = useState<string | null>(null);
  const [isAgentPublished, setIsAgentPublished] = useState(false);
  const [isPublishingAgent, setIsPublishingAgent] = useState(false);
  // Assistant inspector sidebar state
  const [inspectingAssistantNode, setInspectingAssistantNode] = useState<FlowNode | null>(null);
  
  // Auto-fit view when nodes load so Start node is visible
  useEffect(() => {
    if (!reactFlowInstance) return;
    if (nodes && nodes.length > 0) {
      try {
        rfFitView({ padding: 0.2 });
      } catch (e) {
        console.warn('fitView failed:', e);
      }
    }
  }, [nodes, reactFlowInstance, rfFitView]);

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
    
    // Find the node by ID
    const node = nodes.find(n => n.id === nodeId);
    
    if (!node) {
      console.warn(`[WorkflowPage] Node not found: ${nodeId}`);
      return;
    }
    
    console.log(`[WorkflowPage] Node data:`, node.data);
    
    // Set the selected node and assistant node ID
    setSelectedNode(node);
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
          defaultEdgeOptions={defaultEdgeOptions}
          onInit={setReactFlowInstance}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={onNodeDoubleClick}
          onDragOver={onDragOver}
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
          fitView
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
            onPublish={() => publishWorkflow()}
            isPublishing={isPublishingAgent}
            isSaving={isSaving}
            isPublished={isPublished}
          />

          {/* Bottom-left control panel */}
          <ControlPanel
            onZoomOut={() => zoomOut()}
            onZoomIn={() => zoomIn()}
            onFitView={() => rfFitView({ padding: 0.2 })}
            onReset={() => setViewport({ x: 0, y: 0, zoom: 1 })}
            onToggleGrid={() => setShowGrid((v) => !v)}
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
      </div>
        
      {/* Node inspector panel */}
      {selectedNode && (
          <NodeInspectorPanel
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
            onUpdate={(data) => {
              updateNodeData(selectedNode.id, data);
              scheduleAutoSave();
            }}
            onOpenAssistantConfig={(event) => handleOpenAssistantConfigModal(event, selectedNode.id)}
            onTest={() => handleTestNode(selectedNode.id)}
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
