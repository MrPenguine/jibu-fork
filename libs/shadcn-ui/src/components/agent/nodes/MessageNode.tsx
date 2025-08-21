"use client";

import React, { memo } from 'react';
import { NodeProps } from 'reactflow';
import { MessageSquare } from 'lucide-react';
import { PillNodeShell } from './PillNodeShell';

export const MessageNode = memo(({ id, data, selected }: NodeProps) => {
  const description = typeof data.message === 'string' ? data.message : 'Enter your message here';
  return (
    <PillNodeShell
      id={id}
      selected={selected}
      nodeTitle={data.nodeTitle}
      roleTitle={data.role || 'Message'}
      description={description}
      Icon={MessageSquare}
      blockNumber={data.blockNumber}
      onTest={data.onTest}
      onDoubleClick={data.onNodeDoubleClick}
      includeRightHandle
      themeColor={data.color}
    />
  );
});
