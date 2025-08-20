"use client";

import React, { memo } from 'react';
import { NodeProps } from 'reactflow';
import { Puzzle } from 'lucide-react';
import { PillNodeShell } from './PillNodeShell';

export const CustomActionNode = memo(({ data, selected }: NodeProps) => {
  const summaryParts: string[] = [];
  if (data.actionName) summaryParts.push(`Action: ${data.actionName}`);
  if (data.parameters) summaryParts.push('with params');
  if (data.outputVariableName) summaryParts.push(`→ ${data.outputVariableName}`);
  const summary = summaryParts.join(' • ') || 'Custom Action';
  return (
    <PillNodeShell
      id={data.id}
      selected={selected}
      nodeTitle={data.nodeTitle}
      roleTitle={data.role || 'Custom Action'}
      description={summary}
      Icon={Puzzle}
      blockNumber={data.blockNumber}
      onTest={data.onTest}
      onDoubleClick={data.onNodeDoubleClick}
      includeRightHandle
    />
  );
});
