"use client";

import React, { memo } from 'react';
import { NodeProps } from 'reactflow';
import { Component } from 'lucide-react';
import { PillNodeShell } from './PillNodeShell';

export const ComponentNode = memo(({ id, data, selected }: NodeProps) => {
  const summaryParts: string[] = [];
  if (data.componentType) summaryParts.push(`type: ${data.componentType}`);
  if (data.props) summaryParts.push('with props');
  const summary = summaryParts.join(' • ') || 'Component';
  return (
    <PillNodeShell
      id={id}
      selected={selected}
      nodeTitle={data.nodeTitle}
      roleTitle={data.role || 'Component'}
      description={summary}
      Icon={Component}
      blockNumber={data.blockNumber}
      onTest={data.onTest}
      onDoubleClick={data.onNodeDoubleClick}
      includeRightHandle
      themeColor={data.color}
    />
  );
});
