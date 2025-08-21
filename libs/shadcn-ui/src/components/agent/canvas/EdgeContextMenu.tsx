import React from 'react';
import type { FlowEdge } from '@libs/shadcn-ui';

export interface EdgeContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  type: 'edge';
  edgeId: string;
}

export interface EdgeContextMenuProps {
  contextMenu: EdgeContextMenuState;
  setContextMenu: (s: any) => void;
  edges: FlowEdge[];
  setEdges: (updater: any) => void;
  setColorMenu: (s: any) => void;
  setSelectedSwatch: (c: string) => void;
  scheduleAutoSave: () => void;
}

export function EdgeContextMenu(props: EdgeContextMenuProps) {
  const { contextMenu, setContextMenu, edges, setEdges, setColorMenu, setSelectedSwatch, scheduleAutoSave } = props;
  if (!contextMenu?.visible) return null;
  const id = contextMenu.edgeId;
  const edge = edges.find(ed => ed.id === id);
  const runtimeMap = (window as any)?.__edgeColors || {};
  let currentColor: string | undefined = runtimeMap[id] || (edge && (edge as any)?.style?.stroke) || '#94a3b8';

  return (
    <div className="py-1">
      <div className="flex items-stretch divide-x divide-gray-200">
        {/* Color */}
        <button
          className="px-3 py-2 hover:bg-gray-100"
          title="Change color"
          onClick={(e) => {
            e.stopPropagation();
            if (!currentColor) currentColor = '#94a3b8';
            setSelectedSwatch(currentColor);
            setColorMenu({ visible: true, x: contextMenu.x + 205, y: contextMenu.y, kind: 'edge', edgeId: id });
          }}
        >
          <span className="inline-block w-5 h-5 rounded-full border" style={{ background:
            'conic-gradient(from 0deg, red, yellow, lime, cyan, blue, magenta, red)'}} />
        </button>
        {/* Shape toggle */}
        <button
          className="px-3 py-2 hover:bg-gray-100"
          title="Toggle curve"
          onClick={() => {
            try { console.debug('[EdgeContextMenu] toggle curve', { id }); } catch {}
            setEdges((eds: any[]) => eds.map((e: any) => {
              if (e.id !== id) return e;
              const isStep = e.type === 'step' || e.type === 'smoothstep';
              const nextType = isStep ? 'simplebezier' : 'step';
              return ({ ...e, type: nextType });
            }));
            scheduleAutoSave();
            setContextMenu({ visible: false, x: 0, y: 0, type: null });
          }}
        >
          ~
        </button>
        {/* Label text */}
        <button
          className="px-3 py-2 hover:bg-gray-100"
          title="Set text"
          onClick={(e) => {
            e.stopPropagation();
            try { console.debug('[EdgeContextMenu] set text', { id }); } catch {}
            // Trigger edit mode via data flag only. Do not set placeholder label.
            setEdges((eds: any[]) => eds.map((ed: any) => ed.id === id ? ({
              ...ed,
              data: { ...(ed.data || {}), editingLabel: true },
            }) : ed));
            setContextMenu({ visible: false, x: 0, y: 0, type: null });
          }}
        >
          A
        </button>
        {/* Delete */}
        <button
          className="px-3 py-2 hover:bg-gray-100 text-red-600"
          title="Delete edge"
          onClick={() => {
            setEdges((eds: any[]) => eds.filter((e: any) => e.id !== id));
            scheduleAutoSave();
            setContextMenu({ visible: false, x: 0, y: 0, type: null });
          }}
        >
          🗑️
        </button>
      </div>
    </div>
  );
}
