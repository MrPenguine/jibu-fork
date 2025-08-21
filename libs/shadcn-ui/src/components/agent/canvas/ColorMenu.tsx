import React from 'react';
import type { FlowNode, FlowEdge } from '@libs/shadcn-ui';

export type ColorMenuKind = 'node' | 'edge' | undefined;

export interface ColorMenuState {
  visible: boolean;
  x: number;
  y: number;
  kind?: ColorMenuKind;
  nodeId?: string | null;
  edgeId?: string | null;
}

export interface ColorMenuProps {
  state: ColorMenuState;
  setState: (next: ColorMenuState) => void;
  hue: number;
  setHue: (n: number) => void;
  swatches: string[];
  selectedSwatch: string;
  setSelectedSwatch: (c: string) => void;
  nodes: FlowNode[];
  setNodes: React.Dispatch<React.SetStateAction<FlowNode[]>>;
  setEdges: (updater: any) => void;
  updateNodeData: (id: string, data: any) => void;
  scheduleAutoSave: () => void;
  colorMenuRef?: React.RefObject<HTMLDivElement | null>;
}

// Small util (same as page)
const hslToHex = (h: number, s: number, l: number) => {
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x: number) => ('0' + Math.round(x * 255).toString(16)).slice(-2);
  const r = f(0), g = f(8), b = f(4);
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

function HueSlider({ hue, onChange }: { hue: number; onChange: (h: number) => void }) {
  const trackRef = React.useRef<HTMLDivElement | null>(null);

  const clamp = (n: number, min = 0, max = 359) => Math.max(min, Math.min(max, n));

  const computeHue = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return hue;
    const rect = track.getBoundingClientRect();
    const x = clamp(clientX - rect.left, 0, rect.width);
    const ratio = rect.width > 0 ? x / rect.width : 0;
    return clamp(Math.round(ratio * 359));
  };

  const startDrag = (clientX: number) => {
    onChange(computeHue(clientX));
    const onMove = (ev: MouseEvent) => {
      onChange(computeHue(ev.clientX));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const startTouch = (clientX: number) => {
    onChange(computeHue(clientX));
    const onMove = (ev: TouchEvent) => {
      const t = ev.touches[0] || ev.changedTouches[0];
      if (!t) return;
      onChange(computeHue(t.clientX));
    };
    const onEnd = () => {
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
  };

  const leftPct = `${(hue / 359) * 100}%`;

  return (
    <div
      ref={trackRef}
      className="relative w-40 h-3 rounded-full"
      style={{
        background: 'linear-gradient(90deg, hsl(0 100% 50%), hsl(60 100% 50%), hsl(120 100% 50%), hsl(180 100% 50%), hsl(240 100% 50%), hsl(300 100% 50%), hsl(359 100% 50%))',
        cursor: 'pointer',
        pointerEvents: 'all',
      }}
      onMouseDown={(e) => { e.stopPropagation(); startDrag(e.clientX); }}
      onTouchStart={(e) => { e.stopPropagation(); if (e.touches[0]) startTouch(e.touches[0].clientX); }}
    >
      <div
        className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full"
        style={{
          left: leftPct,
          transform: 'translate(-50%, -50%)',
          background: '#0f172a',
          border: '2px solid #fff',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.1)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

export function ColorMenu(props: ColorMenuProps) {
  const { state, setState, hue, setHue, swatches, selectedSwatch, setSelectedSwatch, nodes, setNodes, setEdges, updateNodeData, scheduleAutoSave, colorMenuRef } = props;
  if (!state.visible) return null;
  const { x, y, kind } = state;

  // Throttle live color preview updates to the canvas to prevent drag interruptions
  const rafRef = React.useRef<number | null>(null);
  const scheduleEdgePreview = React.useCallback((hex: string) => {
    if (kind !== 'edge') return;
    const id = state.edgeId!;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      (window as any).__edgeColors = (window as any).__edgeColors || {};
      (window as any).__edgeColors[id] = hex;
      setEdges((eds: any[]) => eds.map((e: any) => e.id === id ? ({
        ...e,
        style: { ...(e.style || {}), stroke: hex },
        markerEnd: e.markerEnd ? { ...(e.markerEnd as any), color: hex } : e.markerEnd,
      }) : e));
    });
  }, [kind, setEdges, state.edgeId]);

  const scheduleNodePreview = React.useCallback((hex: string) => {
    if (kind !== 'node') return;
    const id = state.nodeId!;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const n = nodes.find(nn => nn.id === id);
      if (n) {
        (window as any).__nodeColors = (window as any).__nodeColors || {};
        (window as any).__nodeColors[id] = hex;
        const dataId = (n.data as any)?.id;
        if (dataId) (window as any).__nodeColors[dataId] = hex;
        // Live-update node color in data for visual preview during drag (no autosave here)
        setNodes((nds) => nds.map(nn =>
          nn.id === id
            ? ({ ...nn, data: { ...(nn.data as any), color: hex } }) as any
            : nn
        ));
      }
    });
  }, [kind, nodes, setNodes, state.nodeId]);

  return (
    <div
      className="absolute bg-white border border-gray-200 rounded-md shadow-lg z-50 text-sm select-none"
      style={{ left: x, top: y, minWidth: 220 }}
      ref={colorMenuRef}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: `hsl(${hue} 90% 50%)` }} />
          <HueSlider
            hue={hue}
            onChange={(newHue) => {
              setHue(newHue);
              const c = hslToHex(newHue, 0.9, 0.5);
              scheduleEdgePreview(c);
              scheduleNodePreview(c);
            }}
          />
          <button
            className="w-6 h-6 rounded-full border text-slate-700 flex items-center justify-center"
            title="Apply color"
            onClick={() => {
              const c = hslToHex(hue, 0.9, 0.5);
              if (kind === 'edge') {
                const id = state.edgeId!;
                (window as any).__edgeColors = (window as any).__edgeColors || {};
                (window as any).__edgeColors[id] = c;
                setEdges((eds: any[]) => eds.map((e: any) => e.id === id ? ({
                  ...e,
                  style: { ...(e.style || {}), stroke: c },
                  markerEnd: e.markerEnd ? { ...(e.markerEnd as any), color: c } : e.markerEnd,
                }) : e));
                scheduleAutoSave();
                setState({ visible: false, x: 0, y: 0, kind: undefined, nodeId: null, edgeId: null });
              } else {
                const id = state.nodeId!;
                const n = nodes.find(nn => nn.id === id);
                if (n) {
                  (window as any).__nodeColors = (window as any).__nodeColors || {};
                  (window as any).__nodeColors[id] = c;
                  const dataId = (n.data as any)?.id;
                  if (dataId) (window as any).__nodeColors[dataId] = c;
                  updateNodeData(id, { ...(n.data as any), color: c });
                  scheduleAutoSave();
                }
                setState({ visible: false, x: 0, y: 0, kind: undefined, nodeId: null, edgeId: null });
              }
            }}
          >+
          </button>
        </div>
        {/* no extra styles needed for custom slider */}
        <div className="text-xs text-slate-500 mt-1">Color themes</div>
        <div className="flex items-center gap-3">
          {swatches.map((c) => (
            <button
              key={c}
              className="relative"
              onClick={() => {
                if (kind === 'edge') {
                  const id = state.edgeId!;
                  (window as any).__edgeColors = (window as any).__edgeColors || {};
                  (window as any).__edgeColors[id] = c;
                  setEdges((eds: any[]) => eds.map((e: any) => e.id === id ? ({
                    ...e,
                    style: { ...(e.style || {}), stroke: c },
                    markerEnd: e.markerEnd ? { ...(e.markerEnd as any), color: c } : e.markerEnd,
                  }) : e));
                  scheduleAutoSave();
                  setState({ visible: false, x: 0, y: 0, kind: undefined, edgeId: null, nodeId: null });
                } else {
                  const id = state.nodeId!;
                  const n = nodes.find(nn => nn.id === id);
                  if (n) {
                    (window as any).__nodeColors = (window as any).__nodeColors || {};
                    (window as any).__nodeColors[id] = c;
                    const dataId = (n.data as any)?.id;
                    if (dataId) (window as any).__nodeColors[dataId] = c;
                    updateNodeData(id, { ...(n.data as any), color: c });
                    scheduleAutoSave();
                  }
                  setSelectedSwatch(c);
                  setState({ visible: false, x: 0, y: 0, kind: undefined, nodeId: null, edgeId: null });
                }
              }}
            >
              <span className="w-6 h-6 rounded-full border inline-block" style={{ backgroundColor: c }} />
              {selectedSwatch === c ? (
                <span className="absolute -inset-1 rounded-full ring-2 ring-slate-700 pointer-events-none" />
              ) : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
