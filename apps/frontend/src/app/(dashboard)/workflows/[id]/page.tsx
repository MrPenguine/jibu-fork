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
  WorkflowNodeType,
  FlowNode,
  FlowEdge,
} from '@libs/shadcn-ui';
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
  WorkflowExecutionDialog,
  WorkflowNodeInspector,
} from '@libs/shadcn-ui/components/workflow';
import {
  Save,
  Play,
  ZoomIn,
  ZoomOut,
  Rocket,
} from 'lucide-react';

// Import our custom hook and components
import { useWorkflow, getDefaultNodeData } from '@libs/shadcn-ui/hooks/workflow';
import { WorkflowSidebar } from '@libs/shadcn-ui/components/workflow';
import { NodeInspectorPanel } from '@libs/shadcn-ui/components/workflow';

// Define node types for React Flow
const nodeTypes = {
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

// Import the workflow API
import { workflowApi } from '../../../../utils/workflowApi';

// Main workflow editor component
function WorkflowDetailContent() {
  const params = useParams();
  const workflowId = params.id as string;
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
    selectedNode,
    setSelectedNode,
    isRunDialogOpen,
    setIsRunDialogOpen,
    isPublished,
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

  // Drop handler for drag and drop
  const onDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    if (!reactFlowWrapper.current || !reactFlowInstance) return;

    const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
    const dataTransfer = event.dataTransfer.getData('application/reactflow');
    
    if (!dataTransfer) return;

    const { nodeType, label } = JSON.parse(dataTransfer);

    // Calculate position relative to the viewport
    const position = reactFlowInstance.project({
      x: event.clientX - reactFlowBounds.left,
      y: event.clientY - reactFlowBounds.top,
    });

    // Generate a block number based on existing nodes
    const blockNumber = nodes.length + 1;

    // Create a new node with appropriate data based on type
    const newNode: FlowNode = {
      id: `${nodeType.toLowerCase()}_${Date.now()}`,
      type: nodeType,
      position,
      data: { 
        label: label || nodeType.toString(),
        ...getDefaultNodeData(nodeType),
        blockNumber,
        onTest: handleTestNode
      },
    };

    // Add the new node to the graph
    setNodes((nds: FlowNode[]) => [...nds, newNode]);
    scheduleAutoSave();
  }, [reactFlowInstance, scheduleAutoSave, setNodes]);

  // Handle adding a node via click
  const handleAddNode = useCallback((nodeType: WorkflowNodeType, label: string) => {
    if (!reactFlowInstance) return;

    // Calculate a position in the center of the viewport
    const center = reactFlowInstance.getViewport();
    const position = reactFlowInstance.project({
      x: center.x,
      y: center.y,
    });

    // Create a new node with appropriate data based on type
    const newNode: FlowNode = {
      id: `${nodeType.toLowerCase()}_${Date.now()}`,
      type: nodeType,
      position,
      data: { 
        label: label || nodeType.toString(),
        ...getDefaultNodeData(nodeType)
      },
    };

    // Add the new node to the graph
    setNodes((nds: FlowNode[]) => [...nds, newNode]);
    scheduleAutoSave();
    setActivePopover(null);
  }, [reactFlowInstance, scheduleAutoSave, setNodes, setActivePopover]);

  // Handle run workflow
  const handleRunWorkflow = useCallback(() => {
    setIsRunDialogOpen(true);
  }, [setIsRunDialogOpen]);

  // Handle publish workflow
  const handlePublishWorkflow = useCallback(() => {
    publishWorkflow();
  }, [publishWorkflow]);

  if (isLoading) {
    return <div className="p-8 flex items-center justify-center">Loading workflow...</div>;
  }

  return (
    <div className="h-screen flex flex-col bg-slate-100 text-slate-800">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-white shadow-sm h-14 shrink-0">
        <div className="flex items-center">
          <Input 
            value={workflowName} 
            onChange={(e) => setWorkflowName(e.target.value)}
            onBlur={saveWorkflow}
            className="border-none bg-transparent h-9 px-2 text-lg font-medium focus-visible:ring-0 focus-visible:ring-offset-0 w-64"
            placeholder="Untitled Workflow"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="text-slate-600" 
            onClick={saveWorkflow} 
            disabled={isSaving}
          >
            <Save size={16} className="mr-1" /> 
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Button 
            variant="outline" 
            size="sm" 
            className="text-slate-600" 
            onClick={handleRunWorkflow}
          >
            <Play size={16} className="mr-1" /> 
            Test
          </Button>
          <Button 
            variant={isPublished ? "secondary" : "default"}
            size="sm" 
            className={isPublished ? "bg-green-100 text-green-800 hover:bg-green-200" : ""}
            onClick={handlePublishWorkflow}
          >
            <Rocket size={16} className="mr-1" /> 
            {isPublished ? 'Published' : 'Publish'}
          </Button>
        </div>
      </div>
      
      {/* Main Content Area with Sidebar */}
      <div className="flex flex-grow overflow-hidden">
        {/* Sidebar with Node Categories */}
        <WorkflowSidebar 
          activePopover={activePopover}
          setActivePopover={setActivePopover}
          onDragStart={(event, nodeType, label) => {
            event.dataTransfer.setData('application/reactflow', JSON.stringify({ nodeType, label }));
            event.dataTransfer.effectAllowed = 'move';
            setActivePopover(null);
          }}
          onAddNode={handleAddNode}
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
            <Button variant="ghost" size="sm" className="text-slate-600" onClick={() => reactFlowInstance?.setViewport({ x: 0, y: 0, zoom: 1 })}>
              100%
            </Button>
            <Button variant="ghost" size="icon" className="text-slate-600" onClick={() => reactFlowInstance?.zoomIn()}>
              <ZoomIn size={18}/>
            </Button>
            <div className="h-5 border-l border-slate-300 mx-1"></div>
            <Button variant="default" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5" onClick={handleRunWorkflow}>
              <Play size={14}/> Test your agent
            </Button>
          </div>
        </div>
      </div>
      
      {/* Workflow Execution Dialog */}
      {isRunDialogOpen && workflow && (
        <WorkflowExecutionDialog
          workflowId={workflowId}
          isOpen={isRunDialogOpen}
          onClose={() => setIsRunDialogOpen(false)}
        />
      )}
    </div>
  );
}

// Wrap with ReactFlowProvider
export default function WorkflowDetailPage() {
  return (
    <ReactFlowProvider>
      <WorkflowDetailContent />
    </ReactFlowProvider>
  );
}
