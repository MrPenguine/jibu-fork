"use client";

import React, { useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
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
import { Dialog } from '@libs/shadcn-ui/components/ui/dialog';
import {
  AgentNodeType,
  FlowNode,
  FlowEdge,
} from '@libs/shadcn-ui';
import {
  AssistantConfigModal,
} from '@libs/shadcn-ui/components/agent';
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
} from 'lucide-react';

// Import our custom hook and components
import { getDefaultNodeData } from '@libs/shadcn-ui/hooks/agent';
import { useWorkflow } from '@libs/shadcn-ui/hooks/workflow';
import { AgentSidebar } from '@libs/shadcn-ui/components/agent';
import { NodeInspectorPanel } from '@libs/shadcn-ui/components/agent';

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

// Import the workflow API client
import { workflowApi } from '../../../../../../../utils/workflowApi';
// Import the assistants API for fetching assistant data
import { getAssistant } from '../../../../../../../utils/AssistantsApi';

// Main agent editor component
function AgentDetailContent() {
  const params = useParams();
  const agentId = params.id as string;
  const workflowId = params.workflowId as string;
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { fitView } = useReactFlow();
  
  // Use our custom hook for workflow management
  const {
    workflow,
    workflowName,
    setWorkflowName,
    nodes,
    setNodes,
    edges,
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
  } = useWorkflow(workflowId, workflowApi);

  // State for React Flow instance and active popover
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [activePopover, setActivePopover] = useState<string | null>(null);
  const [isAssistantConfigOpen, setIsAssistantConfigOpen] = useState(false);
  const [selectedAssistantData, setSelectedAssistantData] = useState<any>(null);
  const [selectedAssistantNodeId, setSelectedAssistantNodeId] = useState<string | null>(null);

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
    
    // Get the apiAssistantId from the node data
    const apiAssistantId = (node.data as any).apiAssistantId;
    
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
            name: assistant.name || node.data.name || 'New Assistant',
            systemMessage: assistant.voicemailMessage || node.data.systemMessage || '',
            firstMessage: assistant.firstMessage || node.data.firstMessage || '',
            knowledgeBaseId: assistant.knowledgeBaseId || node.data.knowledgeBaseId || '',
            model: assistant.model || node.data.model || { model: 'gpt-4-turbo', provider: 'openai', temperature: 0.7, maxTokens: 2048 }
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
            id: node.data.id || '',
            apiAssistantId: apiAssistantId,
            name: node.data.name || 'New Assistant',
            systemMessage: node.data.systemMessage || '',
            firstMessage: node.data.firstMessage || '',
            knowledgeBaseId: node.data.knowledgeBaseId || '',
            model: node.data.model || { model: 'gpt-4-turbo', provider: 'openai', temperature: 0.7, maxTokens: 2048 }
          };
          
          console.log(`[WorkflowPage] Falling back to node data for modal:`, JSON.stringify(assistantData, null, 2));
          
          // Set the selected assistant data and open the modal
          setSelectedAssistantData(assistantData);
          setIsAssistantConfigOpen(true);
        });
    } else {
      console.log(`[WorkflowPage] No apiAssistantId found, using node data`);
      
      // Get nodeData from the current scope or use an empty object as fallback
      // Type cast to any to handle the union type safely
      const nodeData = node.data as any || {};
      
      // Prepare the assistant data for the modal using just the node data
      const assistantData = {
        id: node.data.id || '',
        apiAssistantId: '',
        name: node.data.name || 'New Assistant',
        // Use node.data for these properties
        systemMessage: node.data.systemMessage || '',
        firstMessage: node.data.firstMessage || '',
        knowledgeBaseId: node.data.knowledgeBaseId || '',
        // Ensure we have the model object with all required fields
        model: node.data.model || {
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

  // Drop handler for drag and drop
  const onDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    if (!reactFlowWrapper.current || !reactFlowInstance) {
      console.warn('onDrop: reactFlowWrapper or reactFlowInstance not available');
      return;
    }

    const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
    const assistantDataString = event.dataTransfer.getData('application/reactflow');
    console.log('[WorkflowPage onDrop] assistantDataString from drag event:', assistantDataString);

    if (!assistantDataString) {
      console.warn('onDrop: No dataTransferString found');
      return;
    }

    let parsedDragData: any;
    let nodeType: AgentNodeType | string | undefined;
    let label: string | undefined;
    let droppedAssistantData: any | undefined;
    
    try {
      // Try to parse the drag data
      parsedDragData = JSON.parse(assistantDataString);
      console.log('[WorkflowPage onDrop] Parsed data:', JSON.stringify(parsedDragData, null, 2));
      
      // Check explicitly for KB Search node with isKnowledgeBaseSearchNode flag
      if (parsedDragData.isKnowledgeBaseSearchNode) {
        console.log('[WorkflowPage onDrop] KB Search Node detected!');
        nodeType = 'knowledgeBaseSearchNode';
        label = 'Knowledge Base Search';
      } else {
        // Standard node type handling
        nodeType = parsedDragData.type || parsedDragData.nodeType;
        label = parsedDragData.label;
        // assistantData is expected to be a complete object if present
        droppedAssistantData = parsedDragData.assistantData;
      }
    } catch (error) {
      // If parsing fails, it might be a simple string (older drag format)
      console.log('[WorkflowPage onDrop] Parse failed, using raw string:', assistantDataString);
      nodeType = assistantDataString;
      
      // Special handling for KB Search string literal
      if (nodeType === 'knowledgeBaseSearchNode') {
        console.log('[WorkflowPage onDrop] KB Search Node detected from string!');
      }
    } 

    if (!nodeType) {
      console.warn('onDrop: nodeType is undefined after parsing dragData');
      return;
    }

    const position = reactFlowInstance.project({
      x: event.clientX - reactFlowBounds.left,
      y: event.clientY - reactFlowBounds.top,
    });

    const blockNumber = nodes.length + 1;
    const nodeId = `${nodeType.toString().toLowerCase()}_${Date.now()}`;
    let nodeData: any;

    if (nodeType === AgentNodeType.ASSISTANT && droppedAssistantData) {
      // Case 1: Assistant node with full data from sidebar
      nodeData = {
        label: droppedAssistantData.name || 'Assistant',
        name: droppedAssistantData.name || 'Assistant',
        apiAssistantId: droppedAssistantData.apiAssistantId,
        systemMessage: droppedAssistantData.systemMessage,
        firstMessage: droppedAssistantData.firstMessage,
        knowledgeBaseId: droppedAssistantData.knowledgeBaseId,
        model: droppedAssistantData.model, // Directly use the model object
        blockNumber,
        onNodeDoubleClick: (e: React.MouseEvent, id: string) => handleOpenAssistantConfigModal(id),
        onTest: handleTestNode,
        onNodeDataChange: (updatedData: any) => {
          setNodes((nds: FlowNode[]) =>
            nds.map((n: FlowNode) => (n.id === nodeId ? { ...n, data: { ...n.data, ...updatedData } } : n))
          );
          scheduleAutoSave();
        },
        onSave: (updatedData: any) => {
          setNodes((nds: FlowNode[]) =>
            nds.map((n: FlowNode) => (n.id === nodeId ? { ...n, data: { ...n.data, ...updatedData } } : n))
          );
          scheduleAutoSave();
        },
      };
    } else if (nodeType === AgentNodeType.ASSISTANT) {
      // Case 2: Assistant node without data (rare case)
      nodeData = {
        label: 'Assistant',
        name: 'Assistant',
        blockNumber,
        onNodeDoubleClick: (e: React.MouseEvent, id: string) => handleOpenAssistantConfigModal(id),
        onTest: handleTestNode,
        onNodeDataChange: (updatedData: any) => {
          setNodes((nds: FlowNode[]) =>
            nds.map((n: FlowNode) => (n.id === nodeId ? { ...n, data: { ...n.data, ...updatedData } } : n))
          );
          scheduleAutoSave();
        },
        onSave: (updatedData: any) => {
          setNodes((nds: FlowNode[]) =>
            nds.map((n: FlowNode) => (n.id === nodeId ? { ...n, data: { ...n.data, ...updatedData } } : n))
          );
          scheduleAutoSave();
        },
      };
    } else if (nodeType === 'knowledgeBaseSearchNode') {
      // Case 3: KB Search Node - needs special handling with dedicated type
      console.log('[WorkflowPage onDrop] Creating KB Search node data');
      const kbNodeId = `kb_search_${Date.now()}`;
      
      nodeData = {
        id: kbNodeId,
        label: 'Knowledge Base Search',
        knowledgeBaseId: '', // Will be configured by user
        knowledgeBaseName: '',
        query: '',
        outputVariableName: 'kbSearchResult',
        blockNumber,
        // Add callbacks for the node
        onUpdateBlockData: (nodeId: string, updatedData: any) => {
          console.log(`[WorkflowPage] KB Search node data change for node ${nodeId}:`, updatedData);
          setNodes((nds: FlowNode[]) => 
            nds.map((node) => {
              if (node.id === nodeId) {
                return { ...node, data: { ...node.data, ...updatedData } };
              }
              return node;
            })
          );
          scheduleAutoSave();
        },
        onTest: handleTestNode
      };
    } else {
      // Case 4: All other node types
      nodeData = {
        label: label || nodeType.toString(),
        ...getDefaultNodeData(nodeType as AgentNodeType), // Ensure nodeType is AgentNodeType here
        blockNumber,
        onTest: handleTestNode,
      };
    }

    // Create the new node with the appropriate type
    // For KB Search nodes, we need special handling
    let newNodeId = nodeType === 'knowledgeBaseSearchNode' ? nodeData.id : nodeId;
    
    const newNode: FlowNode = {
      id: newNodeId,
      // Use a type assertion to make TypeScript happy while preserving the correct string at runtime
      type: nodeType === 'knowledgeBaseSearchNode' ? 'knowledgeBaseSearchNode' as any : (nodeType as AgentNodeType),
      position,
      data: nodeData,
    };
    
    console.log(`[WorkflowPage onDrop] Creating node: ${newNodeId} with type: ${nodeType}`, newNode);

    setNodes((nds: FlowNode[]) => [...nds, newNode]);
    scheduleAutoSave();
  }, [reactFlowInstance, nodes, getDefaultNodeData, handleOpenAssistantConfigModal, handleTestNode, scheduleAutoSave, setNodes]);

  // Handle adding a node via click
  const handleAddNode = useCallback((nodeType: AgentNodeType, label: string, assistantData?: any) => {
    if (!reactFlowInstance) return;

    // Calculate a position in the center of the viewport
    const center = reactFlowInstance.getViewport();
    const position = reactFlowInstance.project({
      x: center.x,
      y: center.y,
    });

    // Create a unique ID for the node
    const nodeId = `${nodeType.toLowerCase()}_${Date.now()}`;

    // Create node data with appropriate properties based on type
    let nodeData;

    if (nodeType === AgentNodeType.ASSISTANT) {
      // Special handling for assistant nodes
      const isFromSidebar = !!assistantData?.apiAssistantId;
      
      nodeData = {
        label: isFromSidebar ? assistantData.name : (label || 'New Assistant'),
        name: isFromSidebar ? assistantData.name : (label || 'New Assistant'),
        apiAssistantId: assistantData?.apiAssistantId,
        systemMessage: assistantData?.systemMessage || 'I am a helpful assistant.',
        firstMessage: assistantData?.firstMessage || '',
        knowledgeBaseId: assistantData?.knowledgeBaseId || null,
        model: assistantData?.model || { 
          provider: 'openai', 
          model: 'gpt-4-turbo', 
          temperature: 0.7, 
          maxTokens: 2048,
          preference: 'balance'
        },
        onNodeDoubleClick: (e: React.MouseEvent, id: string) => handleOpenAssistantConfigModal(id),
        onTest: handleTestNode,
        onNodeDataChange: (updatedData: any) => {
          // Update the node data in the flow when it changes
          setNodes((nds) => 
            nds.map((node) => {
              if (node.id === nodeId) {
                return { 
                  ...node, 
                  data: { 
                    ...node.data, 
                    ...updatedData 
                  } 
                };
              }
              return node;
            })
          );
          scheduleAutoSave();
        },
        onSave: (updatedData: any) => {
          // For backward compatibility
          setNodes((nds) => 
            nds.map((node) => {
              if (node.id === nodeId) {
                return { 
                  ...node, 
                  data: { 
                    ...node.data, 
                    ...updatedData 
                  } 
                };
              }
              return node;
            })
          );
          scheduleAutoSave();
        }
      };
    } else {
      // Default handling for other node types
      nodeData = {
        label: label || nodeType.toString(),
        ...getDefaultNodeData(nodeType),
        onTest: handleTestNode
      };
    }

    // Create a new node with the data
    const newNode: FlowNode = {
      id: nodeId,
      type: nodeType,
      position,
      data: nodeData,
    };

    // Add the new node to the graph
    setNodes((nds: FlowNode[]) => [...nds, newNode]);
    scheduleAutoSave();
    setActivePopover(null);
  }, [reactFlowInstance, scheduleAutoSave, setNodes, setActivePopover, handleTestNode]);

  // Handle run agent
  const handleRunAgent = useCallback(() => {
    setIsRunDialogOpen(true);
  }, [setIsRunDialogOpen]);

  // Handle publish agent
  const handleSave = useCallback(() => {
    saveWorkflow();
  }, [saveWorkflow]);

  if (isLoading) {
    return <div className="p-8 flex items-center justify-center">Loading workflow...</div>;
  }

  // ... rest of the code remains the same ...

  return (
    <div className="h-screen flex flex-col bg-slate-100 text-slate-800">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-white shadow-sm h-14 shrink-0">
        <div className="flex items-center">
          <Input 
            value={workflowName} 
            onChange={(e) => setWorkflowName(e.target.value)}
            onBlur={handleSave}
            className="border-none bg-transparent h-9 px-2 text-lg font-medium focus-visible:ring-0 focus-visible:ring-offset-0 w-64"
            placeholder="Untitled Workflow"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="text-slate-600" 
            onClick={handleSave} 
            disabled={isLoading}
          >
            <Save size={16} className="mr-1" /> 
            {isLoading ? 'Saving...' : 'Save'}
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Button 
            variant="outline" 
            size="sm" 
            className="text-slate-600" 
            onClick={handleRunAgent}
          >
            <Play size={16} className="mr-1" /> 
            Test
          </Button>
          <Button 
            variant={isPublished ? "secondary" : "default"}
            size="sm" 
            className={isPublished ? "bg-green-100 text-green-800 hover:bg-green-200" : ""}
            onClick={publishWorkflow}
          >
            <Rocket size={16} className="mr-1" /> 
            {isPublished ? 'Published' : 'Publish'}
          </Button>
        </div>
      </div>
      
      {/* Main Content Area with Sidebar */}
      <div className="flex flex-grow overflow-hidden">
        {/* Sidebar with Node Categories */}
        <AgentSidebar 
          activePopover={activePopover}
          setActivePopover={setActivePopover}
          onDragStart={(event, nodeType, data) => {
            // Handle both string labels and assistant data objects
            const dragData = typeof data === 'string' 
              ? { nodeType, label: data }
              : { 
                  nodeType, 
                  label: data && typeof data === 'object' && 'name' in data ? data.name : 'Assistant',
                  assistantData: data
                };
            event.dataTransfer.setData('application/reactflow', JSON.stringify(dragData));
            event.dataTransfer.effectAllowed = 'move';
            setActivePopover(null);
          }}
          onAddNode={(nodeType: AgentNodeType, label: string, assistantData?: any) => {
            handleAddNode(nodeType, label, assistantData);
            setActivePopover(null);
          }}
        />
        
        {/* Canvas Area */}
        <div className="flex-grow relative">
          <div 
            ref={reactFlowWrapper} 
            className="w-full h-full bg-muted/40 relative hide-react-flow-panel"
            onDragOver={onDragOver}
            onDrop={onDrop}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              onNodeDoubleClick={(event, node) => {
                // Set the node as selected to open the inspector
                setSelectedNode(node as FlowNode);
                
                // If it's an assistant node, also open the config modal
                if (node.type === AgentNodeType.ASSISTANT) {
                  handleOpenAssistantConfigModal(event, node.id);
                }
              }}
              nodeTypes={nodeTypes}
              defaultEdgeOptions={defaultEdgeOptions}
              onInit={setReactFlowInstance}
              fitView
              proOptions={{ hideAttribution: true }}
            >
              <Controls />
              <Background color="#aaa" gap={16} />
            </ReactFlow>
            
            {/* Node Inspector Panel */}
            {selectedNode && (
              <NodeInspectorPanel
                selectedNode={selectedNode}
                onClose={() => setSelectedNode(null)}
                onNodeUpdate={(nodeId, data) => {
                  updateNodeData(nodeId, data);
                }}
                assistantId={workflow?.assistantId}
              />
            )}
          </div>
          
          {/* Bottom Bar with Zoom Controls */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center space-x-1 p-1.5 bg-white rounded-lg shadow-md border border-slate-200">
            <Button variant="ghost" size="icon" className="text-slate-600" onClick={() => reactFlowInstance?.zoomOut()}>
              <ZoomOut size={18}/>
            </Button>
            <Button variant="outline" className="gap-1" onClick={() => setWorkflowName(prompt("Enter workflow name:", workflowName) || workflowName)}>
              Rename
            </Button>
            <Button variant="ghost" size="icon" className="text-slate-600" onClick={() => reactFlowInstance?.zoomIn()}>
              <ZoomIn size={18}/>
            </Button>
            <div className="h-5 border-l border-slate-300 mx-1"></div>
            <Button variant="default" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5" onClick={handleRunAgent}>
              <Play size={14}/> Test your workflow
            </Button>
          </div>
        </div>
      </div>
      
      {/* Agent Execution Dialog */}
      {isRunDialogOpen && workflow && (
        <AgentExecutionDialog
          agentId={agentId}
          isOpen={isRunDialogOpen}
          onClose={() => setIsRunDialogOpen(false)}
          agentApi={workflowApi}
        />
      )}
      
      {/* Assistant Configuration Modal */}
      {selectedAssistantData && (
        <AssistantConfigModal
          isOpen={isAssistantConfigOpen}
          onClose={() => setIsAssistantConfigOpen(false)}
          assistantData={selectedAssistantData}
          onSave={(updatedData: any) => {
            console.log(`[WorkflowPage] Received updated data from AssistantConfigModal:`, JSON.stringify(updatedData, null, 2));
            
            if (selectedNode && selectedAssistantNodeId) {
              console.log(`[WorkflowPage] Updating node ${selectedAssistantNodeId} with new data`);
              
              // Update the node data with the changes, ensuring we preserve the apiAssistantId
              setNodes((nds) => 
                nds.map((node) => {
                  if (node.id === selectedAssistantNodeId) {
                    // Create the updated node with merged data
                    // Type cast to any to handle the union type safely
                    const nodeData = node.data as any;
                    const updatedNode = { 
                      ...node, 
                      data: { 
                        ...nodeData, 
                        ...updatedData,
                        // Ensure we preserve the apiAssistantId
                        apiAssistantId: nodeData.apiAssistantId || updatedData.apiAssistantId
                      } 
                    };
                    
                    console.log(`[WorkflowPage] Updated node data:`, JSON.stringify(updatedNode.data, null, 2));
                    return updatedNode;
                  }
                  return node;
                })
              );
              
              // Update the selected assistant data to reflect the changes
              setSelectedAssistantData((prevData: any) => ({
                ...prevData,
                ...updatedData
              }));
              
              scheduleAutoSave();
            } else {
              console.warn(`[WorkflowPage] Cannot update node: selectedNode=${!!selectedNode}, selectedAssistantNodeId=${selectedAssistantNodeId}`);
            }
          }}
        />
      )}
    </div>
  );
}

// Wrap with ReactFlowProvider
export default function AgentDetailPage() {
  return (
    <ReactFlowProvider>
      <AgentDetailContent />
    </ReactFlowProvider>
  );
}
