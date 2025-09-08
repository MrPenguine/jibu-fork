import { StartWebhookAdapter } from './adapters/start-webhook.adapter';
import { AssistantAiAgentAdapter } from './adapters/assistant-ai-agent.adapter';
import { ProviderModelAdapter } from './adapters/provider-model.adapter';

export interface InternalNode {
  id: string;
  type: string;
  data?: Record<string, any>;
  position?: { x: number; y: number };
}

export interface InternalEdgeEnd {
  nodeId: string;
  port?: string; // optional, adapters can use defaults if missing
}

export interface InternalEdge {
  id?: string;
  source: InternalEdgeEnd;
  target: InternalEdgeEnd;
}

export interface InternalGraph {
  nodes: InternalNode[];
  edges: InternalEdge[];
}

export interface CompileContext {
  workflowName: string;
  webhook: { path: string; id: string };
  assistant: { provider: 'openai' | 'anthropic' | 'google'; model: string; systemPrompt?: string };
  credentials: { openai?: { id: string; name: string }; anthropic?: { id: string; name: string }; google?: { id: string; name: string } };
}

export interface CompiledNode {
  id: string; // deterministic id for n8n node
  name: string; // n8n node name
  n8n: any; // compiled n8n node JSON
  portMap: {
    inputs?: Record<string, string>; // internalPort -> n8nPortType
    outputs?: Record<string, string>; // internalPort -> n8nPortType
  };
}

export interface NodeAdapter {
  type: string; // internal type key this adapter handles
  supports(node: InternalNode): boolean;
  compile(node: InternalNode, ctx: CompileContext): CompiledNode;
}

export class AdapterRegistry {
  private adapters: NodeAdapter[] = [];

  register(adapter: NodeAdapter) {
    this.adapters.push(adapter);
  }

  getAdapterFor(node: InternalNode): NodeAdapter {
    const found = this.adapters.find((a) => a.supports(node));
    if (!found) {
      throw new Error(`No adapter registered for node type '${node.type}'`);
    }
    return found;
  }
}

export function buildDefaultAdapterRegistry(): AdapterRegistry {
  const reg = new AdapterRegistry();
  reg.register(new StartWebhookAdapter());
  reg.register(new AssistantAiAgentAdapter());
  reg.register(new ProviderModelAdapter());
  return reg;
}
