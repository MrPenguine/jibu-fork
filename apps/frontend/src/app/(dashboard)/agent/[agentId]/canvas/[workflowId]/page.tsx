"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ReactFlow,
  ReactFlowProvider,
  NodeMouseHandler,
  Connection,
  MarkerType,
  Controls,
  Background,
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
import { AgentNavSidebar } from '@libs/shadcn-ui/components/agent/AgentNavSidebar';
import {
  StartNode,
  EndNode,
  MessageNode,
  ListenNode,
  ChoiceNode,
  ConditionNode,
  SetVariableNode,
  ApiCallNode,
  ToolCallNode,
  AssistantNode,
  KnowledgeBaseSearchNode,
  AgentExecutionDialog,
  AgentNodeInspector,
} from '@libs/shadcn-ui/components/agent';
import {
  Save,
  Play,
  ZoomIn,
  ZoomOut,
  Rocket,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  ArrowLeft,
  Zap,
  Undo,
  Redo,
  Maximize,
  Minimize,
  RotateCcw,
  Share2,
  Settings,
  Loader2
} from 'lucide-react';

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

// Define node types for React Flow
const nodeTypes = {
  [AgentNodeType.START]: StartNode,
  [AgentNodeType.END]: EndNode,
  [AgentNodeType.MESSAGE]: MessageNode,
  [AgentNodeType.LISTEN]: ListenNode,
  [AgentNodeType.CHOICE]: ChoiceNode,
  [AgentNodeType.CONDITION]: ConditionNode,
  [AgentNodeType.SET_VARIABLE]: SetVariableNode,
  [AgentNodeType.API_CALL]: ApiCallNode,
  [AgentNodeType.TOOL_CALL]: ToolCallNode,
  [AgentNodeType.ASSISTANT]: AssistantNode,
  // Register the dedicated KB Search node with its string literal value
  'knowledgeBaseSearchNode': KnowledgeBaseSearchNode,
};

// Default edge options
const defaultEdgeOptions = {
  type: 'smoothstep',
  markerEnd: {
    type: MarkerType.ArrowClosed,
  },
  style: {
    strokeWidth: 2,
  },
};

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
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [activePopover, setActivePopover] = useState<string | null>(null);
  const [isAssistantConfigOpen, setIsAssistantConfigOpen] = useState(false);
  const [selectedAssistantData, setSelectedAssistantData] = useState<any>(null);
  const [selectedAssistantNodeId, setSelectedAssistantNodeId] = useState<string | null>(null);
  const [isAgentPublished, setIsAgentPublished] = useState(false);
  const [isPublishingAgent, setIsPublishingAgent] = useState(false);

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
          <Background />
          <Controls />
          
          {/* Floating action buttons */}
          <div className="absolute top-4 right-4 z-50 flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-lg p-2 shadow-lg border">
            <Button variant="outline" size="sm" onClick={() => saveWorkflow()} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {lastSavedAt ? `Saved` : 'Save'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => publishWorkflow()} disabled={isPublishingAgent || isSaving}>
              {isPublishingAgent ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
              {isPublished ? 'Published' : 'Publish'}
            </Button>
            <Button variant="default" size="sm" onClick={() => setIsRunDialogOpen(true)}>
              <Play className="mr-2 h-4 w-4" />
              Test
            </Button>
          </div>
          
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
