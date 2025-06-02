import { 
  FlowNode, 
  FlowEdge, 
  WorkflowNodeType, 
  MessageNodeData, 
  ListenNodeData, 
  ChoiceNodeData, 
  ConditionNodeData, 
  SetVariableNodeData, 
  ApiCallNodeData, 
  ToolCallNodeData, 
  BaseNodeData 
} from '../../types';
import { Node, Edge, Connection, XYPosition } from 'reactflow';

/**
 * Creates a new node with appropriate type-specific data
 */
export function createNewNode(
  nodeType: WorkflowNodeType, 
  label: string, 
  position: XYPosition
): FlowNode {
  // Create base node
  const newNode: FlowNode = {
    id: `${nodeType.toLowerCase()}_${Date.now()}`,
    type: nodeType,
    position,
    data: { label: label || nodeType.toString() },
  };

  // Add type-specific default properties
  switch (nodeType) {
    case WorkflowNodeType.MESSAGE:
      newNode.data = { 
        ...newNode.data, 
        message: 'Enter your message here' 
      } as MessageNodeData;
      break;
    case WorkflowNodeType.LISTEN:
      newNode.data = { 
        ...newNode.data, 
        variableName: 'user_input' 
      } as ListenNodeData;
      break;
    case WorkflowNodeType.CHOICE:
      newNode.data = { 
        ...newNode.data, 
        choices: [
          { label: 'Option 1', value: 'option_1' },
          { label: 'Option 2', value: 'option_2' }
        ] 
      } as ChoiceNodeData;
      break;
    case WorkflowNodeType.CONDITION:
      newNode.data = { 
        ...newNode.data, 
        variable: 'condition_var',
        operator: 'equals',
        value: 'true'
      } as ConditionNodeData;
      break;
    case WorkflowNodeType.SET_VARIABLE:
      newNode.data = { 
        ...newNode.data, 
        assignments: [{ variableName: 'new_variable', value: '', evaluate: false }]
      } as SetVariableNodeData;
      break;
    case WorkflowNodeType.API_CALL:
      newNode.data = { 
        ...newNode.data, 
        url: 'https://api.example.com',
        method: 'GET',
        headers: {},
        responseVariableName: 'api_response'
      } as ApiCallNodeData;
      break;
    case WorkflowNodeType.TOOL_CALL:
      newNode.data = { 
        ...newNode.data, 
        toolId: '',
        inputMapping: {}
      } as ToolCallNodeData;
      break;
    default:
      break;
  }

  return newNode;
}

/**
 * Sanitizes nodes and edges from workflow data
 */
export function sanitizeWorkflowData(workflowData: any): { nodes: FlowNode[], edges: FlowEdge[] } {
  // Ensure nodes is an array and has valid positions
  let nodes: FlowNode[] = Array.isArray(workflowData?.nodes) 
    ? workflowData.nodes.map((node: any) => {
        // Ensure node has a valid position
        if (!node.position || typeof node.position.x !== 'number' || typeof node.position.y !== 'number') {
          node.position = {
            x: Math.random() * 400 + 50,
            y: Math.random() * 200 + 50,
          };
        }
        return node;
      })
    : [];

  // Ensure edges is an array and filter out invalid edges
  let edges: FlowEdge[] = Array.isArray(workflowData?.edges)
    ? workflowData.edges.filter((edge: any) => edge.source && edge.target)
    : [];

  return { nodes, edges };
}

/**
 * Debounce function for auto-save
 */
export function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<F>): Promise<ReturnType<F>> => {
    if (timeout !== null) {
      clearTimeout(timeout);
    }

    return new Promise(resolve => {
      timeout = setTimeout(() => {
        resolve(func(...args));
      }, waitFor);
    });
  };
}

/**
 * Calculate node position based on drop event and react flow instance
 */
export function calculateNodePosition(event: React.DragEvent<HTMLDivElement>, reactFlowBounds: DOMRect, reactFlowInstance: any) {
  const position = reactFlowInstance.project({
    x: event.clientX - reactFlowBounds.left,
    y: event.clientY - reactFlowBounds.top,
  });
  return position;
}
