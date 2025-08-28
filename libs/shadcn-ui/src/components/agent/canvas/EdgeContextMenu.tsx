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
  const currentType = (edge as any)?.type || 'bezier';

  // Local UI state for the type submenu
  const [typeMenuOpen, setTypeMenuOpen] = React.useState(false);

  const setType = (t: 'bezier' | 'straight' | 'step' | 'smoothstep') => {
    setEdges((eds: any[]) => eds.map((ed: any) => ed.id === id ? ({ ...ed, type: t }) : ed));
    scheduleAutoSave();
    setTypeMenuOpen(false);
  };

  return (
    <div className="py-1">
      <div className="flex items-stretch divide-x divide-gray-200 relative">
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
        {/* Type selector: single button with submenu */}
        <div className="relative">
          <button
            className="px-3 py-2 hover:bg-gray-100 min-w-[40px] text-slate-700 flex items-center justify-center"
            title={`Edge type: ${currentType}`}
            aria-haspopup="menu"
            aria-expanded={typeMenuOpen}
            onClick={(e) => { e.stopPropagation(); setTypeMenuOpen((v) => !v); }}
          >
            <span className={`inline-block ${currentType === 'straight' ? 'text-base' : 'text-sm'} font-medium`}>
              {currentType === 'bezier' ? '∿' : currentType === 'smoothstep' ? 'S' : currentType === 'step' ? '┐' : '—'}
            </span>
          </button>
          {typeMenuOpen && (
            <div
              role="menu"
              aria-label="Choose edge type"
              className="absolute left-1/2 -translate-x-1/2 top-full mt-2 bg-white border border-gray-200 rounded-md shadow-md z-[60] p-1 flex"
            >
              {[
                { key: 'bezier', label: '∿' },
                { key: 'smoothstep', label: 'S' },
                { key: 'step', label: '┐' },
                { key: 'straight', label: '—' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  className={`px-3 py-2 rounded-md hover:bg-gray-100 ${currentType === opt.key ? 'font-semibold text-slate-900' : 'text-slate-600'}`}
                  title={`Set ${opt.key} edge`
                  }
                  onClick={(e) => { e.stopPropagation(); setType(opt.key as any); }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Label text */}
        <button
          className="px-3 py-2 hover:bg-gray-100"
          title="Edit label"
          onClick={(e) => {
            e.stopPropagation();
            try { console.debug('[EdgeContextMenu] edit label', { id }); } catch {}
            // Trigger edit mode via data flag
            setEdges((eds: any[]) => eds.map((ed: any) => ed.id === id ? ({
              ...ed,
              data: { ...(ed.data || {}), editingLabel: true },
            }) : ed));
            setContextMenu({ visible: false, x: 0, y: 0, type: null });
          }}
        >
          ✏️
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
