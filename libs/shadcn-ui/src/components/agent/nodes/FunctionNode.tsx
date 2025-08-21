"use client";

import React, { memo } from 'react';
import { NodeProps } from 'reactflow';
import { Code2 } from 'lucide-react';
import { PillNodeShell } from './PillNodeShell';

export const FunctionNode = memo(({ id, data, selected }: NodeProps) => {
  const summaryParts: string[] = [];
  if (data.functionName) summaryParts.push(`fn: ${data.functionName}`);
  if (data.parameters) summaryParts.push('with params');
  if (data.outputVariableName) summaryParts.push(`→ ${data.outputVariableName}`);
  const summary = summaryParts.join(' • ') || 'Function';
  return (
    <PillNodeShell
      id={id}
      selected={selected}
      nodeTitle={data.nodeTitle}
      roleTitle={data.role || 'Function'}
      description={summary}
      Icon={Code2}
      blockNumber={data.blockNumber}
      onTest={data.onTest}
      onDoubleClick={data.onNodeDoubleClick}
      includeRightHandle
      themeColor={data.color}
    />
  );
});
