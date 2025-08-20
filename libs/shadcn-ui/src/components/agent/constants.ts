import { MarkerType } from 'reactflow';
import { MessageCircle, MousePointer, ListChecks, GitBranch, CodeIcon, Network, FunctionSquare, BrainCircuit, ImageIcon, FileTextIcon, GalleryHorizontal } from 'lucide-react';
import { AgentNodeType } from '../../types';
import { StartNode } from './nodes/StartNode';
import { TriggerNode } from './nodes/TriggerNode';
import { EndNode } from './nodes/EndNode';
import { AssistantNode } from './nodes/AssistantNode';
import { MessageNode } from './nodes/MessageNode';
import { PromptNode } from './nodes/PromptNode';
import { ChoiceNode } from './nodes/ChoiceNode';
import { ButtonsNode } from './nodes/ButtonsNode';
import { CaptureNode } from './nodes/CaptureNode';
import { ConditionNode } from './nodes/ConditionNode';
import { SetVariableNode } from './nodes/SetVariableNode';
import { ComponentNode } from './nodes/ComponentNode';
import { ApiCallNode } from './nodes/ApiCallNode';
import { ToolCallNode } from './nodes/ToolCallNode';
import { FunctionNode } from './nodes/FunctionNode';
import { JavaScriptNode } from './nodes/JavaScriptNode';
import { KnowledgeBaseSearchNode } from './nodes/KnowledgeBaseSearchNode';
import { CallForwardNode } from './nodes/CallForwardNode';
import { CustomActionNode } from './nodes/CustomActionNode';

// Define node types for React Flow
export const nodeTypes = {
  // Core flow
  [AgentNodeType.START]: StartNode,
  [AgentNodeType.END]: EndNode,
  [AgentNodeType.TRANSFER]: CallForwardNode, // legacy mapping retained

  // Assistant
  [AgentNodeType.ASSISTANT]: AssistantNode,

  // Talk
  [AgentNodeType.MESSAGE]: MessageNode,
  [AgentNodeType.PROMPT]: PromptNode,

  // Listen
  [AgentNodeType.CHOICE]: ChoiceNode,
  [AgentNodeType.BUTTONS]: ButtonsNode,
  [AgentNodeType.CAPTURE]: CaptureNode,

  // Logic
  [AgentNodeType.CONDITION]: ConditionNode,
  [AgentNodeType.SET_VARIABLE]: SetVariableNode,
  [AgentNodeType.COMPONENT]: ComponentNode,

  // Dev
  [AgentNodeType.TOOL_CALL]: ToolCallNode,
  [AgentNodeType.FUNCTION]: FunctionNode,
  [AgentNodeType.API_CALL]: ApiCallNode,
  [AgentNodeType.CUSTOM]: JavaScriptNode,
  [AgentNodeType.KNOWLEDGE_BASE_SEARCH]: KnowledgeBaseSearchNode,
  [AgentNodeType.CALL_FORWARD]: CallForwardNode,
  [AgentNodeType.CUSTOM_ACTION]: CustomActionNode,

  // Trigger (kept)
  // If Trigger uses a dedicated type elsewhere, include mapping here when available
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
      { id: 'message', label: 'Message', icon: MessageCircle, type: AgentNodeType.MESSAGE },
      { id: 'prompt', label: 'Prompt', icon: BrainCircuit, type: AgentNodeType.SET_VARIABLE },
      { id: 'image', label: 'Image', icon: ImageIcon, type: AgentNodeType.MESSAGE },
      { id: 'card', label: 'Card', icon: FileTextIcon, type: AgentNodeType.MESSAGE },
      { id: 'carousel', label: 'Carousel', icon: GalleryHorizontal, type: AgentNodeType.MESSAGE },
    ],
  },
  {
    id: 'listen',
    label: 'Listen',
    icon: MousePointer,
    items: [
      { id: 'buttons', label: 'Buttons', icon: MousePointer, type: AgentNodeType.CHOICE },
      { id: 'choice', label: 'Choice', icon: ListChecks, type: AgentNodeType.CHOICE },
      { id: 'condition', label: 'Condition', icon: GitBranch, type: AgentNodeType.CONDITION },
      { id: 'set', label: 'Set Variable', icon: CodeIcon, type: AgentNodeType.SET_VARIABLE },
      { id: 'end', label: 'End', icon: MessageCircle, type: AgentNodeType.END },
    ],
  },
  {
    id: 'dev',
    label: 'Dev',
    icon: Network,
    items: [
      { id: 'api_call', label: 'API Call', icon: Network, type: AgentNodeType.API_CALL },
      { id: 'tool_call', label: 'Tool Call', icon: FunctionSquare, type: AgentNodeType.TOOL_CALL },
    ],
  },
];
