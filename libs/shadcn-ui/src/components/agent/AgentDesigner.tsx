"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  NodeTypes,
  EdgeTypes,
  Panel,
  useReactFlow,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { AgentNodeType, FlowNode, FlowEdge } from '../../../../src';
import { Button } from '../ui/button';
import { AgentPalette } from './AgentPalette';
import { AgentNodeInspector } from './AgentNodeInspector';
import { AssistantConfigModal } from './AssistantConfigModal'; // Added import
import { AssistantNodeData } from './nodes/AssistantNode'; // Added import

// Import custom node components
import { StartNode } from './nodes/StartNode';
import { EndNode } from './nodes/EndNode';
import { MessageNode } from './nodes/MessageNode';
import { ListenNode } from './nodes/ListenNode';
import { ChoiceNode } from './nodes/ChoiceNode';
import { ConditionNode } from './nodes/ConditionNode';
import { SetVariableNode } from './nodes/SetVariableNode';
import { ApiCallNode } from './nodes/ApiCallNode';
import { ToolCallNode } from './nodes/ToolCallNode';
import { AssistantNode } from './nodes/AssistantNode'; // Added import

// Define node types for React Flow
const nodeTypes: NodeTypes = {
  [AgentNodeType.START]: StartNode,
  [AgentNodeType.END]: EndNode,
  [AgentNodeType.MESSAGE]: MessageNode,
  [AgentNodeType.LISTEN]: ListenNode,
  [AgentNodeType.CHOICE]: ChoiceNode,
  [AgentNodeType.CONDITION]: ConditionNode,
  [AgentNodeType.SET_VARIABLE]: SetVariableNode,
  [AgentNodeType.API_CALL]: ApiCallNode,
  [AgentNodeType.TOOL_CALL]: ToolCallNode,
  [AgentNodeType.ASSISTANT]: AssistantNode, // Added AssistantNode mapping
};

// Define edge types for React Flow
const edgeTypes: EdgeTypes = {};

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

export interface AgentDesignerProps {
  initialNodes?: FlowNode[];
  initialEdges?: FlowEdge[];
  onSave?: (nodes: FlowNode[], edges: FlowEdge[]) => void;
  assistantId?: string;
  readOnly?: boolean;
}

export const AgentDesigner: React.FC<AgentDesignerProps> = ({
  initialNodes = [],
  initialEdges = [],
  onSave,
  assistantId,
  readOnly = false,
}) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges as Edge[]);
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const { project } = useReactFlow();

  // State for Assistant Configuration Modal
  const [isAssistantConfigModalOpen, setIsAssistantConfigModalOpen] = useState(false);
  const [editingAssistantNodeData, setEditingAssistantNodeData] = useState<AssistantNodeData | null>(null);

  // Initialize the designer with initial nodes and edges
  useEffect(() => {
    if (initialNodes.length > 0 || initialEdges.length > 0) {
      setNodes(initialNodes as Node[]);
      setEdges(initialEdges as Edge[]);
    }
  }, [initialNodes, initialEdges, setNodes, setEdges]);
  
  // Handle node updates from the inspector
  const onNodeUpdate = useCallback(
    (nodeId: string, data: any) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                ...data,
              },
            };
          }
          return node;
        })
      );
    },
    [setNodes]
  );

  // Function to open the assistant configuration modal
  const handleOpenAssistantConfigModal = useCallback((nodeId: string, data: AssistantNodeData) => {
    setEditingAssistantNodeData({ ...data, id: nodeId }); // Ensure id is part of the data for the modal if needed
    setIsAssistantConfigModalOpen(true);
  }, []);

  // Function to save assistant configuration from the modal
  const handleSaveAssistantConfig = useCallback((updatedData: AssistantNodeData) => {
    if (updatedData.id) {
      // Log updates for debugging
      console.log('Updating node with data:', updatedData);
      
      // Update node data in the flow
      setNodes((nds) => 
        nds.map((node) => {
          if (node.id === updatedData.id) {
            // Create a deep merge of the node data with the updated data
            const mergedData = {
              ...node.data,
              ...updatedData,
              // Ensure model is properly merged
              model: {
                ...(node.data.model || {}),
                ...(updatedData.model || {})
              }
            };
            return {
              ...node,
              data: mergedData
            };
          }
          return node;
        })
      );
    }
    setIsAssistantConfigModalOpen(false);
    setEditingAssistantNodeData(null);
  }, [setNodes]); // Use setNodes instead of onNodeUpdate for more control

  // Handle node selection
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => { // Changed node type to Node
      // Now, single click on any node, including Assistant, will select it and open the inspector.
      // Double-click on AssistantNode will still be handled by the node itself to open the modal.
      setSelectedNode(node as FlowNode); // Cast to FlowNode for setSelectedNode
    },
    [setSelectedNode]
  );

  // Handle edge connection
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, ...defaultEdgeOptions }, eds));
    },
    [setEdges]
  );

  // Handle drag and drop from palette
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!reactFlowWrapper.current) return;

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const dragDataString = event.dataTransfer.getData('application/reactflow');

      // Check if the dropped element is valid
      if (!dragDataString) return;

      let type: AgentNodeType;
      let droppedAssistantData: any = null;

      try {
        const parsedData = JSON.parse(dragDataString);
        type = parsedData.type as AgentNodeType;
        if (parsedData.assistantData) {
          droppedAssistantData = parsedData.assistantData;
        }
      } catch (error) {
        // Fallback for older drag sources or if data is just the type string
        type = dragDataString as AgentNodeType;
      }

      if (!type) return;

      const position = project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      // Create a new node
      let newNodeData: any;
      const baseId = `${type.toLowerCase()}_${Date.now()}`;

      if (type === AgentNodeType.ASSISTANT && droppedAssistantData) {
        // Generate a stable, unique node ID
        const nodeId = droppedAssistantData.apiAssistantId ? 
          `${type.toLowerCase()}_${droppedAssistantData.apiAssistantId}` : 
          `${type.toLowerCase()}_${Date.now()}`;
        
        console.log(`[AgentDesigner] Creating new assistant node with ID: ${nodeId} and apiAssistantId: ${droppedAssistantData.apiAssistantId}`);
        
        // Only pass the apiAssistantId to the AssistantNode component
        // The AssistantNode will load the full ModelConfig data dynamically
        newNodeData = {
          id: nodeId,
          apiAssistantId: droppedAssistantData.apiAssistantId, // Store only the assistant ID from API
          // The rest of the data will be loaded dynamically by the AssistantNode component
          // We don't need to pass name, systemMessage, model, etc. here
          onNodeDoubleClick: (event: React.MouseEvent, nodeId: string) => {
            // Find the node by ID to get its current data
            const node = nodes.find(n => n.id === nodeId);
            if (node && node.type === AgentNodeType.ASSISTANT) {
              // Handle opening the assistant config modal with the node ID
              // This will be handled by the parent component that receives the event
              // No need to call anything here as the event will bubble up
              console.log(`[AgentDesigner] Double-click on assistant node ${nodeId}, event will bubble up`);
            }
          },
          onTest: (nodeId: string) => {
            console.log(`[AgentDesigner] Test assistant node ${nodeId}`);
            // Implement test functionality here
          },
          onNodeDataChange: (updatedData: any) => {
            console.log(`[AgentDesigner] Node data change for node ${nodeId}:`, updatedData);
            // Update the node data in the flow
            setNodes((nds) => 
              nds.map((node) => {
                if (node.id === nodeId) {
                  return { ...node, data: { ...node.data, ...updatedData } };
                }
                return node;
              })
            );
          }
        };
      } else if (type === AgentNodeType.ASSISTANT) { // Fallback if assistantData is not fully there but type is ASSISTANT
        // Generate a stable, unique node ID
        const nodeId = `${type.toLowerCase()}_${Date.now()}`;
        
        console.log(`[AgentDesigner] Creating new assistant node with ID: ${nodeId} without assistant data`);
        
        // Create a minimal node with just enough data for the AssistantNode to render
        // The user will need to configure this node manually
        newNodeData = {
          id: nodeId,
          // No apiAssistantId here, so the AssistantNode will show a configuration UI
          // Only pass minimal data needed for initial rendering
          // Minimal model data for initial rendering
          model: { model: 'gpt-4-turbo', provider: 'openai' },
          onNodeDoubleClick: (event: React.MouseEvent, nodeId: string) => {
            // Find the node by ID to get its current data
            const node = nodes.find(n => n.id === nodeId);
            if (node && node.type === AgentNodeType.ASSISTANT) {
              // Handle opening the assistant config modal with the node ID
              // This will be handled by the parent component that receives the event
              console.log(`[AgentDesigner] Double-click on assistant node ${nodeId}, event will bubble up`);
            }
          },
          onTest: (nodeId: string) => {
            console.log(`[AgentDesigner] Test assistant node ${nodeId}`);
            // Implement test functionality here
          },
          onNodeDataChange: (updatedData: any) => {
            console.log(`[AgentDesigner] Node data change for node ${nodeId}:`, updatedData);
            // Update the node data in the flow using a captured nodeId for closure
            setNodes((nds) => 
              nds.map((node) => {
                if (node.id === nodeId) {
                  const updatedNode = { ...node, data: { ...node.data, ...updatedData } };
                  console.log(`[AgentDesigner] Updated node data:`, updatedNode.data);
                  return updatedNode;
                }
                return node;
              })
            );
            
            // Note: Auto-save will be handled by the parent component
            // We don't have access to scheduleAutoSave here
          }
        };
      } else {
        newNodeData = { 
          id: baseId,
          label: droppedAssistantData?.label || type 
        };
      }

      const newNode: FlowNode = {
        id: newNodeData.id || `${type.toLowerCase()}_${Date.now()}`,
        type,
        position,
        data: newNodeData,
      };

      setNodes((nds) => [...nds, newNode as Node]);
    },
    [project, setNodes]
  );

  // Handle save
  const handleSave = useCallback(() => {
    if (onSave) {
      onSave(nodes as FlowNode[], edges as FlowEdge[]);
    }
  }, [nodes, edges, onSave]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 flex" style={{ height: 'calc(100vh - 200px)' }}>
        <div className="flex-1" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            onDragOver={onDragOver}
            onDrop={onDrop}
            fitView
            proOptions={{ hideAttribution: true }}
            nodesDraggable={!readOnly}
            nodesConnectable={!readOnly}
            elementsSelectable={!readOnly}
          >
            <Controls />
            <Background />
            {!readOnly && (
              <Panel position="top-left">
                <AgentPalette />
              </Panel>
            )}
            <Panel position="top-right">
              {!readOnly && onSave && (
                <Button onClick={handleSave} variant="default">
                  Save Agent
                </Button>
              )}
            </Panel>
          </ReactFlow>
        </div>
        {selectedNode && !readOnly && (
          <div className="w-80 border-l p-4 overflow-y-auto">
            <AgentNodeInspector
              node={selectedNode}
              onUpdate={onNodeUpdate}
              assistantId={assistantId}
            />
          </div>
        )}
      </div>
      {isAssistantConfigModalOpen && editingAssistantNodeData && (
        <AssistantConfigModal
          isOpen={isAssistantConfigModalOpen}
          onClose={() => {
            setIsAssistantConfigModalOpen(false);
            setEditingAssistantNodeData(null);
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
