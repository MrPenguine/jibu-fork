import * as React from 'react';
import { EdgeLabelRenderer, BaseEdge, getBezierPath, getSmoothStepPath, useReactFlow } from 'reactflow';
import type { EdgeProps } from 'reactflow';

// A simple inline editor for the edge label
function InlineEditor({
  id,
  initial,
  color,
  onCommit,
  onCancel,
  showPlaceholder,
}: {
  id: string;
  initial: string;
  color: string;
  onCommit: (val: string) => void;
  onCancel: () => void;
  showPlaceholder?: boolean;
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
          padding: '4px 6px',
          color: color,
          background: '#ffffff',
          borderRadius: '3px',
          border: 'none',
          outline: 'none',
          cursor: 'text',
          userSelect: 'text',
          whiteSpace: 'nowrap',
          pointerEvents: 'all',
          fontWeight: 500,
          fontStyle: 'normal',
          fontSize: 10,
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
          if (!value) onCommit('');
          else onCommit(value);
        }}
        onKeyDown={(ev) => {
          if (ev.key === 'Enter') {
            ev.preventDefault();
            ev.currentTarget.blur();
          } else if (ev.key === 'Escape') {
            ev.preventDefault();
            onCancel();
          }
        }}
      >
        {initial}
      </span>
      {showPlaceholder && val.length === 0 && (
        <span
          style={{
            position: 'absolute',
            top: 0,
            left: 4,
            opacity: 0.5,
            pointerEvents: 'none',
            userSelect: 'none',
            fontStyle: 'normal',
            color: 'gray',
            whiteSpace: 'nowrap',
          }}
        >
          Type something
        </span>
      )}
    </span>
  );
}

export function useLabelEditing(id: string, data: any, label: any, labelX: number, labelY: number, strokeColor: string) {
  const { setEdges } = useReactFlow();
  const [isEditing, setIsEditing] = React.useState(!!data?.editingLabel);
  const [startedByMenu, setStartedByMenu] = React.useState(!!data?.editingLabel);

  React.useEffect(() => {
    if (data?.editingLabel) {
      setIsEditing(true);
      setStartedByMenu(true);
      // Clear the flag to prevent re-triggering
      setEdges((eds) =>
        eds.map((edge) => {
          if (edge.id === id) {
            const { editingLabel, ...restData } = edge.data || {};
            return { ...edge, data: restData };
          }
          return edge;
        })
      );
    }
  }, [data?.editingLabel, id, setEdges]);

  const commit = React.useCallback(
    (val: string) => {
      setEdges((eds) => eds.map((e) => (e.id === id ? { ...e, label: val || undefined } : e)));
      setIsEditing(false);
    },
    [id, setEdges]
  );

  const cancel = React.useCallback(() => {
    setIsEditing(false);
  }, []);

  const labelElement = isEditing ? (
    <div
      style={{
        position: 'absolute',
        transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
        fontSize: 10,
      }}
      className="nodrag nopan"
    >
      <InlineEditor id={id} initial={label as string} color={strokeColor} onCommit={commit} onCancel={cancel} showPlaceholder={startedByMenu} />
    </div>
  ) : label ? (
    <div
      style={{
        position: 'absolute',
        transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
        fontSize: 10,
        color: strokeColor,
      }}
      className="nodrag nopan"
    >
      <span
        onClick={() => { setStartedByMenu(false); setIsEditing(true); }}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          display: 'inline-block',
          padding: '4px 6px',
          background: '#ffffff',
          borderRadius: '3px',
          cursor: 'text',
          pointerEvents: 'all',
          fontWeight: 500,
          fontStyle: 'normal',
        }}
      >
        {label as string}
      </span>
    </div>
  ) : null;

  return { isEditing, setIsEditing, labelElement };
}

export function StepEditableEdge(props: EdgeProps<any>) {
  const { id, sourceX, sourceY, targetX, targetY, label, data } = props;
  // Build an orthogonal (right-angle) polyline path: horizontal to midX, vertical to targetY, horizontal to targetX
  const midX = (sourceX + targetX) / 2;
  const path = `M${sourceX},${sourceY} L${midX},${sourceY} L${midX},${targetY} L${targetX},${targetY}`;
  // Place label at the middle of the vertical segment
  const labelX = midX;
  const labelY = (sourceY + targetY) / 2;
  const strokeColor = (props.style && (props.style as any).stroke) || '#0f172a';
  const { labelElement } = useLabelEditing(id, data, label, labelX, labelY, strokeColor);

  return (
    <>
      <BaseEdge path={path} markerEnd={props.markerEnd} style={{ ...(props.style || {}), stroke: strokeColor }} />
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

export function StraightEditableEdge(props: EdgeProps<any>) {
  const { id, sourceX, sourceY, targetX, targetY, label, data } = props;
  const edgePath = `M${sourceX},${sourceY} L${targetX},${targetY}`;
  const labelX = (sourceX + targetX) / 2;
  const labelY = (sourceY + targetY) / 2;
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

export function SmoothStepEditableEdge(props: EdgeProps<any>) {
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
