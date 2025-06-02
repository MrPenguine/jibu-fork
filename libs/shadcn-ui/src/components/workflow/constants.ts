import { MarkerType } from 'reactflow';
import { WorkflowNodeType } from '../../types';
import { StartNode } from './nodes/StartNode';
import { EndNode } from './nodes/EndNode';
import { MessageNode } from './nodes/MessageNode';
import { ListenNode } from './nodes/ListenNode';
import { ChoiceNode } from './nodes/ChoiceNode';
import { ConditionNode } from './nodes/ConditionNode';
import { SetVariableNode } from './nodes/SetVariableNode';
import { ApiCallNode } from './nodes/ApiCallNode';
import { ToolCallNode } from './nodes/ToolCallNode';
import { MessageCircle, MousePointer, ListChecks, GitBranch, CodeIcon, Network, FunctionSquare, BrainCircuit, ImageIcon, FileTextIcon, GalleryHorizontal } from 'lucide-react';

// Define node types for React Flow
export const nodeTypes = {
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
export const defaultEdgeOptions = {
  type: 'smoothstep',
  markerEnd: {
    type: MarkerType.ArrowClosed,
  },
  style: {
    strokeWidth: 2,
  },
};

// Simple toast mock for notifications
export const toast = {
  success: (message: string) => console.log('Success:', message),
  error: (message: string) => console.error('Error:', message),
  info: (message: string) => console.info('Info:', message)
};

// Sidebar navigation items with node types
export const sidebarNavItems = [
  {
    id: 'talk',
    label: 'Talk',
    icon: MessageCircle,
    items: [
      { id: 'message', label: 'Message', icon: MessageCircle, type: WorkflowNodeType.MESSAGE },
      { id: 'prompt', label: 'Prompt', icon: BrainCircuit, type: WorkflowNodeType.SET_VARIABLE },
      { id: 'image', label: 'Image', icon: ImageIcon, type: WorkflowNodeType.MESSAGE },
      { id: 'card', label: 'Card', icon: FileTextIcon, type: WorkflowNodeType.MESSAGE },
      { id: 'carousel', label: 'Carousel', icon: GalleryHorizontal, type: WorkflowNodeType.MESSAGE },
    ],
  },
  {
    id: 'listen',
    label: 'Listen',
    icon: MousePointer,
    items: [
      { id: 'buttons', label: 'Buttons', icon: MousePointer, type: WorkflowNodeType.CHOICE },
      { id: 'choice', label: 'Choice', icon: ListChecks, type: WorkflowNodeType.CHOICE },
      { id: 'condition', label: 'Condition', icon: GitBranch, type: WorkflowNodeType.CONDITION },
      { id: 'set', label: 'Set Variable', icon: CodeIcon, type: WorkflowNodeType.SET_VARIABLE },
      { id: 'end', label: 'End', icon: MessageCircle, type: WorkflowNodeType.END },
    ],
  },
  {
    id: 'dev',
    label: 'Dev',
    icon: Network,
    items: [
      { id: 'api_call', label: 'API Call', icon: Network, type: WorkflowNodeType.API_CALL },
      { id: 'tool_call', label: 'Tool Call', icon: FunctionSquare, type: WorkflowNodeType.TOOL_CALL },
    ],
  },
];
