"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

// A simple sticky note node with inline editable textarea. No handles.
export type NoteNodeData = {
  text?: string;
  color?: string; // optional background color
  width?: number;
  height?: number;
  rotation?: number; // degrees
  fontSize?: number; // px
};

export function NoteNode({ id, data, selected }: NodeProps<NoteNodeData>) {
  const [text, setText] = useState<string>(data?.text ?? '');
  const [width, setWidth] = useState<number>(data?.width ?? 224); // 14rem default
  const [height, setHeight] = useState<number>(data?.height ?? 128);
  const [rotation, setRotation] = useState<number>(data?.rotation ?? 0);
  const [fontSize, setFontSize] = useState<number>(data?.fontSize ?? 14);
  const [isEditing, setIsEditing] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const fitDebounceRef = useRef<number | null>(null);

  // Font size bounds
  const MIN_FONT = 10;
  const MAX_FONT = 28;

  useEffect(() => {
    // keep local state in sync if external updates occur
    // do not overwrite text while editing, to allow deletions/typing
    if (!isEditing && data?.text !== undefined && data.text !== text) setText(data.text);
    if (data?.width && data.width !== width) setWidth(data.width);
    if (data?.height && data.height !== height) setHeight(data.height);
    if (data?.rotation !== undefined && data.rotation !== rotation) setRotation(data.rotation);
    if (data?.fontSize && data.fontSize !== fontSize) setFontSize(data.fontSize);
  }, [isEditing, data?.text, data?.width, data?.height, data?.rotation, data?.fontSize]);

  // Auto-grow textarea to fit content (no scrollbars)
  const autoGrow = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    // Temporarily reset height to let scrollHeight reflect content
    ta.style.height = 'auto';
    const next = Math.max(64, ta.scrollHeight);
    // Resize container to fit content (no scrollbars)
    setHeight(next + 16); // include padding
  };
  useEffect(() => {
    autoGrow();
  }, [text, fontSize, width]);

  // Fit font to container to avoid overflow in both edit and view modes
  const fitsAtSize = (size: number) => {
    const el = measureRef.current;
    if (!el) return true;
    el.style.fontSize = `${size}px`;
    // Force layout and check overflow
    // Use scroll size vs client size
    const fitsH = el.scrollHeight <= el.clientHeight + 0.5; // small tolerance
    const fitsW = el.scrollWidth <= el.clientWidth + 0.5;
    return fitsH && fitsW;
  };

  const fitFont = () => {
    const el = measureRef.current;
    if (!el) return;
    // Binary search between bounds
    let low = MIN_FONT;
    let high = MAX_FONT;
    // Start search around current font to minimize jumps
    let best = Math.min(Math.max(fontSize, MIN_FONT), MAX_FONT);
    // If current overflows, shrink; if there's space, try to grow
    if (!fitsAtSize(best)) {
      high = best;
    } else {
      low = best;
    }
    for (let i = 0; i < 8; i++) { // sufficient precision for px sizes
      const mid = Math.floor((low + high) / 2);
      if (mid === best) break;
      if (fitsAtSize(mid)) {
        best = mid;
        low = mid;
      } else {
        high = mid;
      }
    }
    // If even at minimum size it still doesn't fit and we're in view mode,
    // grow the card height to accommodate content.
    if (!isEditing && !fitsAtSize(MIN_FONT)) {
      // Set to required scrollHeight of measuring element plus padding
      const required = el.scrollHeight + 16; // matches textarea padding compensation
      if (required > height) {
        setHeight(required);
      }
      // After height grows, exit now; next effect cycle will refit font to fill space
      return;
    }
    if (best !== fontSize) {
      setFontSize(best);
      // emit style so outer canvas can persist fontSize
      const evt = new CustomEvent('note:style', {
        detail: { id, width, height, rotation, fontSize: best },
      });
      window.dispatchEvent(evt);
    }
  };

  // Debounce fitting to avoid interfering with typing latency
  const scheduleFit = () => {
    if (fitDebounceRef.current) cancelAnimationFrame(fitDebounceRef.current);
    fitDebounceRef.current = requestAnimationFrame(() => {
      fitDebounceRef.current = null;
      fitFont();
    });
  };

  useEffect(() => {
    scheduleFit();
    // Also fit on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, width, height, isEditing]);

  // Helpers to emit style change
  const emitStyle = (next: Partial<NoteNodeData>) => {
    const evt = new CustomEvent('note:style', {
      detail: { id, width, height, rotation, fontSize, ...next },
    });
    window.dispatchEvent(evt);
  };

  // Drag state for handles
  const dragState = useRef<{ type: 'left'|'right'|'top'|'bottom'|'tl'|'tr'|'bl'|'br'|'rotate'|'midH'|'midV'|null; startX: number; startY: number; startW: number; startH: number; startR: number; startF: number; lastDx: number; lastDy: number; } | null>(null);

  const onHandleDown = (type: NonNullable<typeof dragState.current>['type']) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragState.current = {
      type,
      startX: e.clientX,
      startY: e.clientY,
      startW: width,
      startH: height,
      startR: rotation,
      startF: fontSize,
      lastDx: 0,
      lastDy: 0,
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp, { once: true });
    // avoid entering edit while manipulating handles
    setIsEditing(false);
  };

  const onMove = (e: MouseEvent) => {
    const ds = dragState.current; if (!ds) return;
    const dx = e.clientX - ds.startX;
    const dy = e.clientY - ds.startY;
    let w = ds.startW;
    let h = ds.startH;
    let r = ds.startR;
    let f = ds.startF;
    switch (ds.type) {
      case 'left': w = Math.max(120, ds.startW - dx); break;
      case 'right': w = Math.max(120, ds.startW + dx); break;
      case 'top': h = Math.max(80, ds.startH - dy); break;
      case 'bottom': h = Math.max(80, ds.startH + dy); break;
      case 'midH': w = Math.max(120, ds.startW + dx * 2); h = Math.max(80, ds.startH + dy * 0); break;
      case 'midV': h = Math.max(80, ds.startH + dy * 2); break;
      case 'tl': w = Math.max(120, ds.startW - dx); h = Math.max(80, ds.startH - dy); f = Math.max(10, ds.startF + (dx + dy) * 0.05); break;
      case 'tr': w = Math.max(120, ds.startW + dx); h = Math.max(80, ds.startH - dy); f = Math.max(10, ds.startF + (dx - dy) * 0.05); break;
      case 'bl': w = Math.max(120, ds.startW - dx); h = Math.max(80, ds.startH + dy); f = Math.max(10, ds.startF + (-dx + dy) * 0.05); break;
      case 'br': w = Math.max(120, ds.startW + dx); h = Math.max(80, ds.startH + dy); f = Math.max(10, ds.startF + (dx + dy) * 0.05); break;
      case 'rotate': {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const angle = Math.atan2(e.clientY - cy, e.clientX - cx);
          r = (angle * 180) / Math.PI + 90; // top reference
        }
        break;
      }
    }
    // keep track of last deltas for offset calculation on mouseup
    ds.lastDx = dx;
    ds.lastDy = dy;
    setWidth(w); setHeight(h); setRotation(r); setFontSize(f);
  };

  const onUp = () => {
    window.removeEventListener('mousemove', onMove);
    const ds = dragState.current; dragState.current = null;
    let offsetX = 0;
    let offsetY = 0;
    if (ds) {
      const affectsLeft = ds.type === 'left' || ds.type === 'tl' || ds.type === 'bl';
      const affectsTop = ds.type === 'top' || ds.type === 'tl' || ds.type === 'tr';
      if (affectsLeft) offsetX = ds.lastDx; // moving mouse left (negative) should move node left
      if (affectsTop) offsetY = ds.lastDy;   // moving mouse up (negative) should move node up
    }
    // include offsets so page can move node position appropriately
    const evt = new CustomEvent('note:style', {
      detail: { id, width, height, rotation, fontSize, offsetX, offsetY },
    });
    window.dispatchEvent(evt);
  };

  // Click to enter edit mode when not dragging/rotating/resizing
  const onContainerClick = useCallback(() => {
    if (dragState.current) return;
    setIsEditing(true);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  const onTextKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      (e.currentTarget as HTMLTextAreaElement).blur();
      setIsEditing(false);
    }
    if (e.key === 'Escape') {
      (e.currentTarget as HTMLTextAreaElement).blur();
      setIsEditing(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="group relative rounded-md shadow-sm border-2 border-blue-300 bg-blue-100 p-0 cursor-default"
      style={{ width, height, transform: `rotate(${rotation}deg)`, transformOrigin: 'center center' }}
      onClick={onContainerClick}
      onMouseDown={(e) => { e.stopPropagation(); }}
    >
      {/* hidden measurement element for font fitting */}
      <div
        ref={measureRef}
        className="absolute top-0 left-0 w-full h-full p-3 whitespace-pre-wrap break-words overflow-auto text-base font-medium"
        style={{
          opacity: 0,
          pointerEvents: 'none',
          zIndex: -1,
        }}
      >
        {text || 'Type something'}
      </div>
      {/* rotation line */}
      {(selected) && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-px h-6 bg-blue-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      )}

      {/* textarea or display */}
      {isEditing ? (
        <textarea
          ref={textareaRef}
          className="nodrag w-full h-full p-3 bg-transparent border-none outline-none resize-none text-gray-800 overflow-hidden text-base font-medium"
          value={text}
          placeholder="Type something"
          onChange={(e) => { setText(e.target.value); }}
          style={{ fontSize }}
          onKeyDown={onTextKeyDown}
          onBlur={(e) => {
            const evt = new CustomEvent('note:changed', { detail: { id, text: e.target.value } });
            window.dispatchEvent(evt);
            setIsEditing(false);
          }}
        />
      ) : (
        <div className="w-full h-full p-3">
          <div className={`text-base font-medium whitespace-pre-wrap break-words ${text ? 'text-gray-800' : 'text-gray-400'}`} style={{ fontSize }}>
            {text || 'Type something'}
          </div>
        </div>
      )}

      {(selected) && (
        <>
          {/* rotate handle (top center, above) */}
          <button onMouseDown={onHandleDown('rotate')} className="nodrag absolute -top-3 left-1/2 -translate-x-1/2 w-3 h-3 bg-blue-500 rounded-full cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Rotate" />
          {/* side handles */}
          <button onMouseDown={onHandleDown('left')} className="nodrag absolute top-1/2 -left-1.5 -translate-y-1/2 w-2 h-2 bg-blue-500 rounded-sm cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Resize left" />
          <button onMouseDown={onHandleDown('right')} className="nodrag absolute top-1/2 -right-1.5 -translate-y-1/2 w-2 h-2 bg-blue-500 rounded-sm cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Resize right" />
          <button onMouseDown={onHandleDown('top')} className="nodrag absolute -top-1.5 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-500 rounded-sm cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Resize top" />
          <button onMouseDown={onHandleDown('bottom')} className="nodrag absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-500 rounded-sm cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Resize bottom" />
          {/* corner handles (resize + font scaling) */}
          <button onMouseDown={onHandleDown('tl')} className="nodrag absolute -top-1.5 -left-1.5 w-2 h-2 bg-blue-500 rounded-sm cursor-nw-resize opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Resize topleft" />
          <button onMouseDown={onHandleDown('tr')} className="nodrag absolute -top-1.5 -right-1.5 w-2 h-2 bg-blue-500 rounded-sm cursor-ne-resize opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Resize topright" />
          <button onMouseDown={onHandleDown('bl')} className="nodrag absolute -bottom-1.5 -left-1.5 w-2 h-2 bg-blue-500 rounded-sm cursor-sw-resize opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Resize bottomleft" />
          <button onMouseDown={onHandleDown('br')} className="nodrag absolute -bottom-1.5 -right-1.5 w-2 h-2 bg-blue-500 rounded-sm cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Resize bottomright" />
        </>
      )}
      {/* No flow connection handles for notes */}
      <Handle type="source" position={Position.Left} style={{ display: 'none' }} />
      <Handle type="source" position={Position.Right} style={{ display: 'none' }} />
      <Handle type="target" position={Position.Top} style={{ display: 'none' }} />
      <Handle type="target" position={Position.Bottom} style={{ display: 'none' }} />
    </div>
  );
}

export default NoteNode;
