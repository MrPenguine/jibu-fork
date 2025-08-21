"use client";

import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Play } from 'lucide-react';
import { Card } from '../../ui/card';

interface PillNodeShellProps {
  id: string;
  selected?: boolean;
  nodeTitle?: string;
  roleTitle: string;
  description?: string;
  Icon?: React.ComponentType<{ className?: string }>;
  blockNumber?: number;
  onTest?: (nodeId: string) => void;
  onDoubleClick?: (event: React.MouseEvent, nodeId: string) => void;
  /**
   * Backward-compatible flag: include a default right source handle.
   * If `handles` prop is provided, this flag is ignored.
   */
  includeRightHandle?: boolean;
  /**
   * Optional explicit handle configuration. When provided, these handles are rendered
   * instead of the default hidden left target (and optional right source) handles.
   */
  handles?: Array<{
    id?: string;
    type: 'source' | 'target';
    position: Position;
    className?: string;
    style?: React.CSSProperties;
    isValidConnection?: (connection: any) => boolean;
  }>;
  /** Theme base color (hex). Will be rendered as a lighter background and border. */
  themeColor?: string;
}

export const PillNodeShell = memo(function PillNodeShell(props: PillNodeShellProps) {
  const {
    id,
    selected,
    nodeTitle,
    roleTitle,
    description,
    Icon,
    blockNumber,
    onTest,
    onDoubleClick,
    includeRightHandle,
    handles,
    themeColor,
  } = props;

  // Helpers to derive lighter variants
  const hexToRgb = (hex?: string) => {
    if (!hex) return null;
    const h = hex.replace('#', '');
    const bigint = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return { r, g, b };
  };
  const withAlpha = (hex?: string, alpha = 0.18) => {
    const rgb = hexToRgb(hex);
    if (!rgb) return undefined;
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  };
  // Prefer runtime map color (for live slider updates) and fall back to prop themeColor
  const liveColor = (typeof window !== 'undefined' ? (window as any)?.__nodeColors?.[id] : undefined);
  const runtimeColor = liveColor ?? themeColor;
  // Default base swatch (lighter slate) used across UI color menu as the first/active swatch
  const DEFAULT_BASE_HEX = '#94a3b8';
  // When no color is set, compute bg/border from the default swatch so visuals match the active selection
  const bgColor = withAlpha(runtimeColor ?? DEFAULT_BASE_HEX, 0.18);
  const borderColor = withAlpha(runtimeColor ?? DEFAULT_BASE_HEX, 0.35);

  const title = nodeTitle || `New Block${typeof blockNumber === 'number' ? ` ${blockNumber}` : ''}`;

  return (
    <div
      className={`w-96 p-4 rounded-2xl border group transition-colors cursor-pointer ${selected ? 'ring-2 ring-slate-400' : ''}`}
      style={{ backgroundColor: bgColor, borderColor: borderColor }}
      onDoubleClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDoubleClick?.(e, id);
      }}
      data-type="pillNode"
    >
      {/* Handles */}
      {Array.isArray(handles) && handles.length > 0 ? (
        // Render provided handles
        handles.map((h, idx) => (
          <Handle
            key={h.id ?? idx}
            id={h.id}
            type={h.type}
            position={h.position}
            className={h.className ?? 'w-2 h-2 opacity-0 bg-transparent'}
            style={h.style}
            isValidConnection={h.isValidConnection}
          />
        ))
      ) : (
        <>
          {/* Default hidden left handle (target), vertically centered */}
          <Handle
            id="in"
            type="target"
            position={Position.Left}
            className="w-2 h-2 opacity-0 bg-transparent"
            style={{ left: -6, top: '50%', transform: 'translateY(-50%)' }}
            isValidConnection={(connection) => connection.source !== id}
          />
          {includeRightHandle ? (
            <Handle
              id="out"
              type="source"
              position={Position.Right}
              className="w-2 h-2 opacity-0 bg-transparent"
              style={{ right: -6, top: '50%', transform: 'translateY(-50%)' }}
            />
          ) : null}
        </>
      )}

      {/* Header with hover Play */}
      <div className="mb-3 relative">
        <h3 className="text-slate-600 font-medium text-sm">{title}</h3>
        <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <div
            className="w-4 h-4 bg-slate-400 rounded-sm flex items-center justify-center"
            onClick={(e) => {
              e.stopPropagation();
              onTest?.(id);
            }}
            role="button"
            aria-label="Test block"
          >
            <Play className="w-2.5 h-2.5 text-white" />
          </div>
        </div>
      </div>

      {/* Content Card */}
      <Card className="p-4 bg-white border-slate-200 shadow-sm">
        <div className="flex items-start gap-3">
          {/* Icon */}
          {Icon ? (
            <div className="flex-shrink-0 mt-0.5">
              <div className="w-5 h-5 rounded bg-slate-100 flex items-center justify-center">
                <Icon className="w-3 h-3 text-slate-600" />
              </div>
            </div>
          ) : null}

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-slate-900 text-sm mb-1">{roleTitle}</h4>
            {description ? (
              <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">{description}</p>
            ) : null}
          </div>
        </div>
      </Card>
    </div>
  );
});
