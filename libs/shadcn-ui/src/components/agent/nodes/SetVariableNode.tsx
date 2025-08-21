"use client";

import React, { memo } from 'react';
import { NodeProps } from 'reactflow';
import { Variable } from 'lucide-react';
import { PillNodeShell } from './PillNodeShell';

export const SetVariableNode = memo(({ id, data, selected }: NodeProps) => {
  const summary = Array.isArray(data.assignments) && data.assignments.length
    ? data.assignments.slice(0, 2).map((a: any) => `${a.variableName} = ${typeof a.value === 'object' ? JSON.stringify(a.value) : String(a.value)}`).join('; ').slice(0, 80) + (data.assignments.length > 2 ? '…' : '')
    : 'Set Variable';
  return (
    <PillNodeShell
      id={id}
      selected={selected}
      nodeTitle={data.nodeTitle}
      roleTitle={data.role || 'Set Variable'}
      description={summary}
      Icon={Variable}
      blockNumber={data.blockNumber}
      onTest={data.onTest}
      onDoubleClick={data.onNodeDoubleClick}
      includeRightHandle
      themeColor={data.color}
    />
  );
});
