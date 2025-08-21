"use client";

import React, { memo } from 'react';
import { NodeProps } from 'reactflow';
import { Mic } from 'lucide-react';
import { PillNodeShell } from './PillNodeShell';

export const CaptureNode = memo(({ id, data, selected }: NodeProps) => {
  const summaryParts: string[] = [];
  if (data.variableName) summaryParts.push(`→ ${data.variableName}`);
  if (Array.isArray(data.expectedPhrases) && data.expectedPhrases.length)
    summaryParts.push(`${data.expectedPhrases.length} hints`);
  const summary = summaryParts.join(' • ') || 'Capture';
  return (
    <PillNodeShell
      id={id}
      selected={selected}
      nodeTitle={data.nodeTitle}
      roleTitle={data.role || 'Capture'}
      description={summary}
      Icon={Mic}
      blockNumber={data.blockNumber}
      onTest={data.onTest}
      onDoubleClick={data.onNodeDoubleClick}
      includeRightHandle
      themeColor={data.color}
    />
  );
});
