"use client";

import React, { memo } from 'react';
import { NodeProps } from 'reactflow';
import { FileCode2 } from 'lucide-react';
import { PillNodeShell } from './PillNodeShell';

export const JavaScriptNode = memo(({ id, data, selected }: NodeProps) => {
  const summary = data.code
    ? `JS: ${data.code.length > 80 ? data.code.slice(0, 80) + '…' : data.code}${data.outputVariableName ? ` → ${data.outputVariableName}` : ''}`
    : 'JavaScript';
  return (
    <PillNodeShell
      id={id}
      selected={selected}
      nodeTitle={data.nodeTitle}
      roleTitle={data.role || 'JavaScript'}
      description={summary}
      Icon={FileCode2}
      blockNumber={data.blockNumber}
      onTest={data.onTest}
      onDoubleClick={data.onNodeDoubleClick}
      includeRightHandle
      themeColor={data.color}
    />
  );
});
