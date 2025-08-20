"use client";

import React, { memo } from 'react';
import { NodeProps } from 'reactflow';
import { ListFilter } from 'lucide-react';
import { PillNodeShell } from './PillNodeShell';

export const ChoiceNode = memo(({ id, data, selected }: NodeProps) => {
  const choicesSummary = Array.isArray(data.choices) && data.choices.length
    ? `Choices: ${data.choices.map((c: any) => c.label).slice(0, 3).join(', ')}${data.choices.length > 3 ? '…' : ''}`
    : 'Present choices to user';
  return (
    <PillNodeShell
      id={data.id}
      selected={selected}
      nodeTitle={data.nodeTitle}
      roleTitle={data.role || 'Choice'}
      description={choicesSummary}
      Icon={ListFilter}
      blockNumber={data.blockNumber}
      onTest={data.onTest}
      onDoubleClick={data.onNodeDoubleClick}
      includeRightHandle
    />
  );
});
