"use client";

import React, { memo } from 'react';
import { Position, NodeProps } from 'reactflow';
import { GitBranch } from 'lucide-react';
import { PillNodeShell } from './PillNodeShell';

export const ConditionNode = memo(({ id, data, selected }: NodeProps) => {
  const desc = data.variable ? `${data.variable} ${data.operator} ${data.value}` : 'Condition';
  return (
    <PillNodeShell
      id={id}
      selected={selected}
      nodeTitle={data.nodeTitle}
      roleTitle={data.role || 'Condition'}
      description={desc}
      Icon={GitBranch}
      blockNumber={data.blockNumber}
      onTest={data.onTest}
      onDoubleClick={data.onNodeDoubleClick}
      themeColor={data.color}
      handles={[
        {
          id: 'in',
          type: 'target',
          position: Position.Left,
          className: 'w-2 h-2 bg-yellow-500 invisible',
        },
        {
          id: 'false',
          type: 'source',
          position: Position.Right,
          className: 'w-2 h-2 bg-red-500 top-[60%] right-0 translate-x-1/2',
        },
        {
          id: 'true',
          type: 'source',
          position: Position.Right,
          className: 'w-2 h-2 bg-green-500 top-[40%] right-0 translate-x-1/2',
        },
      ]}
    />
  );
});
