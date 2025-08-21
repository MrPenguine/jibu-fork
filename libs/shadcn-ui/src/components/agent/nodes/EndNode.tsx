"use client";

import React, { memo } from 'react';
import { NodeProps } from 'reactflow';
import { Square } from 'lucide-react';
import { PillNodeShell } from './PillNodeShell';

export const EndNode = memo(({ id, data, selected }: NodeProps) => {
  return (
    <PillNodeShell
      id={id}
      selected={selected}
      nodeTitle={data.nodeTitle}
      roleTitle={data.role || 'End'}
      description={'Agent ends in current state'}
      Icon={Square}
      blockNumber={data.blockNumber}
      onTest={data.onTest}
      onDoubleClick={data.onNodeDoubleClick}
      includeRightHandle={false}
      themeColor={data.color}
    />
  );
});
