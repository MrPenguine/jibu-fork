"use client";

import React, { memo } from 'react';
import { NodeProps } from 'reactflow';
import { BrainCircuit } from 'lucide-react';
import { PillNodeShell } from './PillNodeShell';

export const PromptNode = memo(({ id, data, selected }: NodeProps) => {
  const summary = data.prompt
    ? `Prompt: ${data.prompt.length > 80 ? data.prompt.slice(0, 80) + '…' : data.prompt}${data.outputVariableName ? ` → ${data.outputVariableName}` : ''}`
    : 'Prompt';
  return (
    <PillNodeShell
      id={id}
      selected={selected}
      nodeTitle={data.nodeTitle}
      roleTitle={data.role || 'Prompt'}
      description={summary}
      Icon={BrainCircuit}
      blockNumber={data.blockNumber}
      onTest={data.onTest}
      onDoubleClick={data.onNodeDoubleClick}
      includeRightHandle
      themeColor={data.color}
    />
  );
});
