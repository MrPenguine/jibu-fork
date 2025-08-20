"use client";

import React, { memo } from 'react';
import { NodeProps } from 'reactflow';
import { Globe } from 'lucide-react';
import { PillNodeShell } from './PillNodeShell';

export const ApiCallNode = memo(({ data, selected }: NodeProps) => {
  const summary = data.url
    ? `${data.method || 'GET'} ${data.url}${data.responseVariableName ? ` → ${data.responseVariableName}` : ''}`
    : 'API Call';
  return (
    <PillNodeShell
      id={data.id}
      selected={selected}
      nodeTitle={data.nodeTitle}
      roleTitle={data.role || 'API Call'}
      description={summary}
      Icon={Globe}
      blockNumber={data.blockNumber}
      onTest={data.onTest}
      onDoubleClick={data.onNodeDoubleClick}
      includeRightHandle
    />
  );
});
