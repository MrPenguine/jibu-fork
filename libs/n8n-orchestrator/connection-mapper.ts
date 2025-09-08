import { CompiledNode, InternalEdge } from './adapter-registry';

export interface N8nConnections {
  [sourceNodeName: string]: {
    [n8nOutType: string]: Array<Array<{
      node: string;
      type: string;
      index: number;
    }>>;
  };
}

/**
 * Build n8n connections from internal edges using each node's adapter-declared port maps.
 * If an internal edge's ports are omitted, defaults to 'main' -> 'main'.
 */
export function buildConnections(
  compiled: CompiledNode[],
  edges: InternalEdge[],
): N8nConnections {
  const byId = new Map<string, CompiledNode>();
  compiled.forEach((c) => byId.set(c.id, c));

  const byName = new Map<string, CompiledNode>();
  compiled.forEach((c) => byName.set(c.name, c));

  // We also need a lookup internalId -> compiled node by matching suffix in deterministic id
  // Our deterministic ids are like `${label-kebab}-${internalId}`
  const byInternalId = new Map<string, CompiledNode>();
  compiled.forEach((c) => {
    const parts = String(c.id).split('-');
    const internalId = parts[parts.length - 1];
    if (internalId) byInternalId.set(internalId, c);
  });

  const connections: N8nConnections = {};

  const ensureBuckets = (sourceName: string, outType: string) => {
    if (!connections[sourceName]) connections[sourceName] = {} as any;
    if (!connections[sourceName][outType]) connections[sourceName][outType] = [[]];
  };

  for (const e of edges) {
    const src = byInternalId.get(e.source.nodeId);
    const dst = byInternalId.get(e.target.nodeId);
    if (!src || !dst) continue; // skip if missing

    const outPort = (e.source.port || 'main');
    const inPort = (e.target.port || 'main');

    const outType = src.portMap.outputs?.[outPort] || 'main';
    const inType = dst.portMap.inputs?.[inPort] || 'main';

    ensureBuckets(src.name, outType);
    connections[src.name][outType][0].push({ node: dst.name, type: inType, index: 0 });
  }

  return connections;
}
