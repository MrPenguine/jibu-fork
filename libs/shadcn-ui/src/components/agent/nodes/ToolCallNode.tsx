"use client";

import React, { memo } from 'react';
import { NodeProps } from 'reactflow';
import { Wrench } from 'lucide-react';
import { PillNodeShell } from './PillNodeShell';

export const ToolCallNode = memo(({ id, data, selected }: NodeProps) => {
  const summary = data.toolId
    ? `${data.toolName || 'Tool'} • ${data.toolId}${data.outputVariableName ? ` → ${data.outputVariableName}` : ''}`
    : (data.toolName || 'Tool Call');
  return (
    <PillNodeShell
      id={id}
      selected={selected}
      nodeTitle={data.nodeTitle || data.toolName}
      roleTitle={data.role || 'Tool Call'}
      description={summary}
      Icon={Wrench}
      blockNumber={data.blockNumber}
      onTest={data.onTest}
      onDoubleClick={data.onNodeDoubleClick}
      includeRightHandle
      themeColor={data.color}
    />
  );
});
