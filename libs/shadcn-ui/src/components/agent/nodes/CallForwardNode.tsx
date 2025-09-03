"use client";

import React, { memo } from 'react';
import { NodeProps } from 'reactflow';
import { ArrowRight } from 'lucide-react';
import { PillNodeShell } from './PillNodeShell';

export const CallForwardNode = memo(({ id, data, selected }: NodeProps) => {
  const summaryParts: string[] = [];
  if (data.targetType) summaryParts.push(`${data.targetType}`);
  if (data.targetAddress) summaryParts.push(`→ ${data.targetAddress}`);
  const summary = summaryParts.join(' • ') || 'Call Forward';
  return (
    <PillNodeShell
      id={id}
      selected={selected}
      nodeTitle={data.nodeTitle}
      roleTitle={data.role || 'Call Forward'}
      description={summary}
      Icon={ArrowRight}
      blockNumber={data.blockNumber}
      onTest={data.onTest}
      onDoubleClick={data.onNodeDoubleClick}
      includeRightHandle
      themeColor={data.color}
    />
  );
});
