import React from 'react';
import {
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  useReactFlow,
  BaseEdge,
  EdgeProps,
} from 'reactflow';

// Shared inline editor component
function InlineEditor({
  id,
  initial,
  color,
  onCommit,
  onCancel,
}: {
  id: string;
  initial: string;
  color: string;
  onCommit: (val: string) => void;
  onCancel: () => void;
}) {
  const ref = React.useRef<HTMLSpanElement | null>(null);
  const [val, setVal] = React.useState<string>(initial || '');
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const t = setTimeout(() => {
      el.focus();
      // select contents
      const r = document.createRange();
      r.selectNodeContents(el);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(r);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <span
        ref={ref}
        role="textbox"
        aria-label="Edge label"
        contentEditable
        suppressContentEditableWarning
        style={{
          display: 'inline-block',
          minWidth: 120,
          padding: '0px 4px',
          color: color,
          background: 'rgba(255,255,255,0.6)',
          border: 'none',
          outline: 'none',
          cursor: 'text',
          userSelect: 'text',
          whiteSpace: 'nowrap',
          pointerEvents: 'all',
        }}
        onInput={(e) => {
          const txt = (e.currentTarget as HTMLElement).innerText;
          setVal(txt);
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onBlur={(ev) => {
          const value = ev.currentTarget.innerText.trim();
          // If cleared, commit empty -> edge label becomes undefined (removed)
          if (!value) onCommit(''); else onCommit(value);
        }}
        onKeyDown={(ev) => {
          if (ev.key === 'Enter') {
            ev.preventDefault();
            const value = (ev.currentTarget as HTMLElement).innerText.trim();
            (ev.currentTarget as HTMLElement).blur();
            onCommit(value);
          } else if (ev.key === 'Escape') {
            ev.preventDefault();
            onCancel();
          }
        }}
      >
        {initial}
      </span>
      {(!val || !val.trim()) && (
        <span
          style={{
            position: 'absolute',
            left: 4,
            top: 0,
            lineHeight: '16px',
            color: 'rgba(15,23,42,0.45)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          Type something
        </span>
      )}
    </span>
  );
}

function useLabelEditing(id: string, data: any, label: React.ReactNode | undefined, x: number, y: number, color: string) {
  const { setEdges } = useReactFlow();
  const [isEditing, setIsEditing] = React.useState<boolean>(false);

  // Trigger edit when context menu set data.editingLabel true
  React.useEffect(() => {
    if (data?.editingLabel) {
      try { console.debug('[EditableEdge] enter edit', { id, label, data }); } catch {}
      setIsEditing(true);
      // clear the flag so we don't loop
      setEdges((eds: any[]) => eds.map((e: any) => e.id === id ? ({ ...e, data: { ...(e.data || {}), editingLabel: undefined } }) : e));
    }
  }, [data?.editingLabel, id, setEdges]);

  const commit = React.useCallback((val: string) => {
    setEdges((eds: any[]) => eds.map((e: any) => e.id === id ? ({ ...e, label: val || undefined }) : e));
    setIsEditing(false);
    window.dispatchEvent(new CustomEvent('edge:labelSaved', { detail: { id, text: val } }));
  }, [id, setEdges]);

  const cancel = React.useCallback(() => {
    // If label was empty/placeholder, remove it
    const wasEmpty = typeof label !== 'string' || !label?.toString?.().trim();
    setEdges((eds: any[]) => eds.map((e: any) => e.id === id ? ({ ...e, label: wasEmpty ? undefined : e.label }) : e));
    setIsEditing(false);
  }, [id, label, setEdges]);

  // Only render when editing or when there is a non-empty label
  const hasText = typeof label === 'string' && !!label.trim();
  const wantsEditing = !!data?.editingLabel || isEditing;
  const labelElement = (wantsEditing || hasText) ? (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        if (!hasText) return; // don't enter edit unless text exists; use context menu to start
        e.stopPropagation();
        setIsEditing(true);
      }}
      style={{
        transform: `translate(-50%, -50%)`,
        position: 'absolute',
        left: x,
        top: y,
        fontSize: 12,
        pointerEvents: 'all',
        zIndex: 1000,
      }}
      className="nodrag nopan"
    >
      {wantsEditing ? (
        <InlineEditor id={id} initial={hasText ? (label as string) : ''} color={color} onCommit={commit} onCancel={cancel} />
      ) : (
        <span
          style={{
            display: 'inline-block',
            padding: '0px 4px',
            background: 'rgba(255,255,255,0.4)',
            borderRadius: 3,
            color: color,
            userSelect: 'none',
            whiteSpace: 'nowrap',
            cursor: 'text',
            pointerEvents: 'all',
          }}
        >
          {label as string}
        </span>
      )}
    </div>
  ) : null;

  return { isEditing, setIsEditing, labelElement };
}

export function StepEditableEdge(props: EdgeProps<any>) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, label, data } = props;
  const [edgePath, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const strokeColor = (props.style && (props.style as any).stroke) || '#0f172a';
  const { labelElement } = useLabelEditing(id, data, label, labelX, labelY, strokeColor);

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={props.markerEnd} style={{ ...(props.style || {}), stroke: strokeColor }} />
      <EdgeLabelRenderer>
        {labelElement}
      </EdgeLabelRenderer>
    </>
  );
}

export function BezierEditableEdge(props: EdgeProps<any>) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, label, data } = props;
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const strokeColor = (props.style && (props.style as any).stroke) || '#0f172a';
  const { labelElement } = useLabelEditing(id, data, label, labelX, labelY, strokeColor);

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={props.markerEnd} style={{ ...(props.style || {}), stroke: strokeColor }} />
      <EdgeLabelRenderer>
        {labelElement}
      </EdgeLabelRenderer>
    </>
  );
}
