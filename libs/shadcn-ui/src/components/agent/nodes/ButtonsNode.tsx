"use client";

import React, { memo } from 'react';
import { NodeProps } from 'reactflow';
import { ListChecks } from 'lucide-react';
import { PillNodeShell } from './PillNodeShell';

export const ButtonsNode = memo(({ id, data, selected }: NodeProps) => {
  const summaryParts: string[] = [];
  if (Array.isArray(data.choices)) summaryParts.push(`${data.choices.length} options`);
  const summary = summaryParts.join(' • ') || 'Buttons';
  return (
    <PillNodeShell
      id={id}
      selected={selected}
      nodeTitle={data.nodeTitle}
      roleTitle={data.role || 'Buttons'}
      description={summary}
      Icon={ListChecks}
      blockNumber={data.blockNumber}
      onTest={data.onTest}
      onDoubleClick={data.onNodeDoubleClick}
      includeRightHandle
      themeColor={data.color}
    />
  );
});
