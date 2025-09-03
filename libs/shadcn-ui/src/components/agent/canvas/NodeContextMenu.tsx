import React from 'react';
import type { FlowNode } from '@libs/shadcn-ui';
import { AgentNodeType } from '@libs/shadcn-ui';

export interface NodeContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  type: 'node';
  nodeId: string;
}

export interface NodeContextMenuProps {
  contextMenu: NodeContextMenuState;
  setContextMenu: (s: any) => void;
  nodes: FlowNode[];
  setNodes: (updater: any) => void;
  setSelectedNode: (n: FlowNode | null) => void;
  setColorMenu: (s: any) => void;
  setSelectedSwatch: (c: string) => void;
  scheduleAutoSave: () => void;
}

export function NodeContextMenu(props: NodeContextMenuProps) {
  const { contextMenu, setContextMenu, nodes, setNodes, setSelectedNode, setColorMenu, setSelectedSwatch, scheduleAutoSave } = props;
  if (!contextMenu?.visible) return null;
  const id = contextMenu.nodeId;
  const node = nodes.find(nn => nn.id === id);
  const isStart = node?.type === AgentNodeType.START;

  return (
    <div className="py-1">
      {!isStart && (
        <button
          className="w-full text-left px-3 py-2 hover:bg-gray-100"
          onClick={() => {
            if (!node) return;
            const clone: FlowNode = { ...node, id: `${node.type}-${Date.now()}`, position: { x: (node.position?.x ?? 0) + 24, y: (node.position?.y ?? 0) + 24 } } as any;
            setNodes((nds: any[]) => [...nds, clone]);
            scheduleAutoSave();
            setContextMenu({ visible: false, x: 0, y: 0, type: null });
          }}
        >Duplicate</button>
      )}
      {!isStart && (
        <button
          className="w-full text-left px-3 py-2 hover:bg-gray-100 text-red-600"
          onClick={() => {
            setNodes((nds: any[]) => nds.filter((n: any) => n.id !== id));
            setSelectedNode(null);
            scheduleAutoSave();
            setContextMenu({ visible: false, x: 0, y: 0, type: null });
          }}
        >Delete</button>
      )}
      <button
        className="w-full text-left px-3 py-2 hover:bg-gray-100"
        onClick={() => {
          if (node) setSelectedNode(node as FlowNode);
          setContextMenu({ visible: false, x: 0, y: 0, type: null });
        }}
      >Rename</button>
      <div className="relative">
        <button
          className="w-full text-left px-3 py-2 hover:bg-gray-100"
          onClick={(e) => {
            e.stopPropagation();
            const runtimeMap = (window as any)?.__nodeColors || {};
            let currentColor: string | undefined = runtimeMap[id] || (node && (node.data as any)?.color) || undefined;
            if (!currentColor || !['#94a3b8','#60a5fa','#86efac','#fda4af','#f59e0b'].includes(currentColor)) currentColor = '#94a3b8';
            setSelectedSwatch(currentColor);
            setColorMenu({ visible: true, x: contextMenu.x + 205, y: contextMenu.y, kind: 'node', nodeId: id, edgeId: null });
          }}
        >Change color ▸</button>
      </div>
    </div>
  );
}
