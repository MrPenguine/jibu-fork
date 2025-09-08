import { AdapterRegistry, buildDefaultAdapterRegistry, CompileContext, CompiledNode, InternalGraph, InternalNode, InternalEdge } from './adapter-registry';
import { buildConnections } from './connection-mapper';

export interface CompileOptions {
  synthesizeAssistantAndProvider?: boolean; // when true and graph lacks them, inject based on ctx.assistant
}

function hasNodeOfType(graph: InternalGraph, type: string): boolean {
  return graph.nodes.some((n) => (n.type || '').toUpperCase() === type.toUpperCase());
}

function cloneGraph(graph: InternalGraph): InternalGraph {
  return {
    nodes: graph.nodes.map((n) => ({ ...n, data: n.data ? { ...n.data } : undefined, position: n.position ? { ...n.position } : undefined })),
    edges: graph.edges.map((e) => ({ id: e.id, source: { ...e.source }, target: { ...e.target } })),
  };
}

/**
 * Inject ASSISTANT + PROVIDER_MODEL nodes and wire:
 *  - START.main -> ASSISTANT.main
 *  - PROVIDER_MODEL.model -> ASSISTANT.ai_languageModel
 */
function synthesizeAssistantAndProvider(graph: InternalGraph): InternalGraph {
  const g = cloneGraph(graph);

  // Find the first START node as source
  const start = g.nodes.find((n) => (n.type || '').toUpperCase() === 'START') || g.nodes[0];

  // Add assistant node
  const assistantNode: InternalNode = {
    id: 'assistant',
    type: 'ASSISTANT',
    position: { x: (start?.position?.x ?? 100) + 240, y: (start?.position?.y ?? 100) - 32 },
    data: {},
  };
  // Add provider node
  const providerNode: InternalNode = {
    id: 'provider',
    type: 'PROVIDER_MODEL',
    position: { x: assistantNode.position!.x, y: (assistantNode.position!.y ?? 0) + 208 },
    data: {},
  };

  g.nodes.push(assistantNode, providerNode);

  // Wire START -> ASSISTANT (main)
  if (start) {
    const edgeMain: InternalEdge = {
      source: { nodeId: start.id, port: 'main' },
      target: { nodeId: assistantNode.id, port: 'main' },
    };
    g.edges.push(edgeMain);
  }

  // Wire PROVIDER -> ASSISTANT (model -> ai_languageModel)
  const edgeModel: InternalEdge = {
    source: { nodeId: providerNode.id, port: 'model' },
    target: { nodeId: assistantNode.id, port: 'ai_languageModel' },
  };
  g.edges.push(edgeModel);

  return g;
}

export function compileGraphToN8n(
  inputGraph: InternalGraph,
  ctx: CompileContext,
  options: CompileOptions = { synthesizeAssistantAndProvider: true },
  registry?: AdapterRegistry,
) {
  const reg = registry ?? buildDefaultAdapterRegistry();

  // Optionally synthesize nodes when graph only has START
  let graph: InternalGraph = inputGraph;
  const hasStart = hasNodeOfType(graph, 'START');
  const hasAssistant = hasNodeOfType(graph, 'ASSISTANT');
  const hasProvider = hasNodeOfType(graph, 'PROVIDER_MODEL');

  if (options.synthesizeAssistantAndProvider && hasStart && (!hasAssistant || !hasProvider)) {
    graph = synthesizeAssistantAndProvider(graph);
  }

  // Compile nodes via adapters
  const compiled: CompiledNode[] = graph.nodes.map((node) => {
    const adapter = reg.getAdapterFor(node);
    return adapter.compile(node, ctx);
  });

  // Build connections from edges
  const connections = buildConnections(compiled, graph.edges);

  // Extract n8n nodes
  const nodes = compiled.map((c) => c.n8n);

  const workflow = {
    name: ctx.workflowName,
    nodes,
    connections,
    settings: { executionOrder: 'v1' },
    active: false,
    pinData: {},
  };

  return workflow;
}
