// Define AgentNodeType enum for both frontend and backend
export enum AgentNodeType {
  START = 'START',
  END = 'END',
  MESSAGE = 'MESSAGE',
  LISTEN = 'LISTEN',
  CHOICE = 'CHOICE',
  CONDITION = 'CONDITION',
  SET_VARIABLE = 'SET_VARIABLE',
  API_CALL = 'API_CALL',
  TOOL_CALL = 'TOOL_CALL',
  ASSISTANT = 'ASSISTANT',
  TRANSFER = 'TRANSFER',
  RECORD = 'RECORD',
  PLAY_AUDIO = 'PLAY_AUDIO'
}

// Base node data interface
export interface BaseNodeData {
  // Common data for all nodes, if any
  label?: string;
}

// Message node data
export interface MessageNodeData extends BaseNodeData {
  message: string; // Supports variable interpolation, e.g., "Hello {{variables.userName}}"
  // For voice:
  ttsProvider?: string; // e.g., 'azure', 'openai', 'elevenlabs'
  voiceId?: string; // Specific voice for TTS
}

// Listen node data
export interface ListenNodeData extends BaseNodeData {
  variableName: string; // Where to store the user's input
  // For voice:
  expectedPhrases?: string[]; // Hints for ASR
  endOfSpeechTimeoutMs?: number;
  // For text (e.g., if expecting specific button presses):
  inputType?: 'text' | 'button_id';
}

// Choice node data
export interface ChoiceNodeData extends BaseNodeData {
  message?: string; // Optional message before choices
  choices: Array<{ label: string; value: string; targetNodeId?: string }>; // `targetNodeId` can be an edge override
  variableName?: string; // If you want to store the *chosen value*
}

// Condition node data
export interface ConditionNodeData extends BaseNodeData {
  // Conditions will be defined on EDGES emanating from this node
  // or this node could have multiple output ports (e.g., 'true', 'false')
  // Alternatively, a simpler model:
  variable: string; // e.g., "variables.userInput"
  operator: 'equals' | 'contains' | 'startsWith' | 'isSet' | 'isNotSet' | 'greaterThan' | 'lessThan';
  value: any;
  trueTargetNodeId?: string; // Edge to follow if true
  falseTargetNodeId?: string; // Edge to follow if false
}

// Set variable node data
export interface SetVariableNodeData extends BaseNodeData {
  assignments: Array<{ variableName: string; value: string | number | boolean | object | null; evaluate?: boolean }>; // `evaluate` if value is an expression
}

// API call node data
export interface ApiCallNodeData extends BaseNodeData {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>; // Support variable interpolation
  body?: string; // JSON string, supports variable interpolation
  responseVariableName?: string; // Where to store the response (or parts of it using JSONPath)
  timeoutMs?: number;
}

// Tool call node data
export interface ToolCallNodeData extends BaseNodeData {
  toolId: string; // ID of the tool from your existing Tools system
  inputMapping: Record<string, string>; // Map agent variables to tool input parameters, e.g., { "toolParamName": "{{variables.agentVar}}" }
  outputVariableName?: string; // Where to store the tool's output
}

// Assistant node data
export interface AssistantNodeData extends BaseNodeData {
  assistantId: string; // ID of the assistant to use
  prompt?: string; // Optional prompt to send to the assistant
  inputVariableName?: string; // Variable containing user input to send to assistant
  outputVariableName?: string; // Where to store the assistant's response
}

// Transfer node data
export interface TransferNodeData extends BaseNodeData {
  targetType: 'sip' | 'phoneNumber' | 'agent'; // 'agent' could be another internal queue/user
  targetAddress: string; // SIP URI or phone number
  // Optional: custom headers for SIP, context to pass on transfer
}

// Record node data
export interface RecordNodeData extends BaseNodeData {
  maxDurationMs: number;
  beep?: boolean;
  outputVariableName: string; // Where to store the recording URL or data
}

// Play audio node data
export interface PlayAudioNodeData extends BaseNodeData {
  audioUrl: string; // URL to the audio file
  // Optional: volume, loop, etc.
}

// Union type for all node data types
export type FlowNodeData =
  | MessageNodeData
  | ListenNodeData
  | ChoiceNodeData
  | ConditionNodeData
  | SetVariableNodeData
  | ApiCallNodeData
  | ToolCallNodeData
  | AssistantNodeData
  | TransferNodeData
  | RecordNodeData
  | PlayAudioNodeData
  | BaseNodeData; // For simple nodes like START, END

// Flow node interface
export interface FlowNode {
  id: string; // Unique ID for the node within the agent
  type: AgentNodeType;
  data: FlowNodeData;
  position: { x: number; y: number }; // For visual designer (React Flow)
}

// Flow edge interface
export interface FlowEdge {
  id: string;
  source: string; // ID of the source node
  target: string; // ID of the target node
  sourceHandle?: string; // Optional: for nodes with multiple output ports
  targetHandle?: string; // Optional: for nodes with multiple input ports
  label?: string; // Optional: edge label
  condition?: { // Optional: condition for conditional edges
    variable: string;
    operator: 'equals' | 'contains' | 'startsWith' | 'isSet' | 'isNotSet' | 'greaterThan' | 'lessThan';
    value: any;
  };
}

// Agent definition interface
export interface AgentDefinition {
  id: string;
  name: string;
  description?: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  startNodeId?: string;
  assistantId: string;
  organizationId: string;
  version: number;
  isPublished: boolean;
  publishedAt?: Date;
}

// Agent session output interface
export interface AgentSessionOutput {
  sessionId: string;
  status: string; // ACTIVE, PAUSED, COMPLETED, ERROR
  currentNodeId?: string;
  output?: any; // The output of the last executed node, if any
  nextAction?: {
    type: string; // e.g., 'message', 'listen', 'choice', 'completed'
    data: any; // Action-specific data
  };
  error?: string; // Error message if status is ERROR
}

// Agent session interface
export interface AgentSession {
  id: string;
  agentId: string;
  organizationId: string;
  currentNodeId?: string;
  variables: Record<string, any>;
  history?: Array<{ nodeId: string; input?: any; output?: any; timestamp: Date }>;
  status: string;
  endedAt?: Date;
  callSid?: string;
  phoneNumber?: string;
  chatId?: string;
}
