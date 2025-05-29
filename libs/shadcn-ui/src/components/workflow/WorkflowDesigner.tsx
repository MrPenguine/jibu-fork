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
import { WorkflowNodeType, FlowNode, FlowEdge } from '../../../../../libs/src';
import { Button } from '../ui/button';
import { WorkflowPalette } from './WorkflowPalette';
import { WorkflowNodeInspector } from './WorkflowNodeInspector';

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

// Define node types for React Flow
const nodeTypes: NodeTypes = {
  [WorkflowNodeType.START]: StartNode,
  [WorkflowNodeType.END]: EndNode,
  [WorkflowNodeType.MESSAGE]: MessageNode,
  [WorkflowNodeType.LISTEN]: ListenNode,
  [WorkflowNodeType.CHOICE]: ChoiceNode,
  [WorkflowNodeType.CONDITION]: ConditionNode,
  [WorkflowNodeType.SET_VARIABLE]: SetVariableNode,
  [WorkflowNodeType.API_CALL]: ApiCallNode,
  [WorkflowNodeType.TOOL_CALL]: ToolCallNode,
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

export interface WorkflowDesignerProps {
  initialNodes?: FlowNode[];
  initialEdges?: FlowEdge[];
  onSave?: (nodes: FlowNode[], edges: FlowEdge[]) => void;
  assistantId?: string;
  readOnly?: boolean;
}

export const WorkflowDesigner: React.FC<WorkflowDesignerProps> = ({
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

  // Initialize the designer with initial nodes and edges
  useEffect(() => {
    if (initialNodes.length > 0 || initialEdges.length > 0) {
      setNodes(initialNodes as Node[]);
      setEdges(initialEdges as Edge[]);
    }
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Handle node selection
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNode(node as FlowNode);
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
      const type = event.dataTransfer.getData('application/reactflow') as WorkflowNodeType;

      // Check if the dropped element is valid
      if (!type) return;

      const position = project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      // Create a new node
      const newNode: FlowNode = {
        id: `${type.toLowerCase()}_${Date.now()}`,
        type,
        position,
        data: {
          label: type,
        },
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
                <WorkflowPalette />
              </Panel>
            )}
            <Panel position="top-right">
              {!readOnly && onSave && (
                <Button onClick={handleSave} variant="default">
                  Save Workflow
                </Button>
              )}
            </Panel>
          </ReactFlow>
        </div>
        {selectedNode && !readOnly && (
          <div className="w-80 border-l p-4 overflow-y-auto">
            <WorkflowNodeInspector
              node={selectedNode}
              onUpdate={onNodeUpdate}
              assistantId={assistantId}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export const WorkflowDesignerWithProvider: React.FC<WorkflowDesignerProps> = (props) => {
  return (
    <ReactFlowProvider>
      <WorkflowDesigner {...props} />
    </ReactFlowProvider>
  );
};
