"use client";

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

export const EndNode = memo(({ data }: NodeProps) => {
  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-white border-2 border-red-500 min-w-[150px] text-center">
      <div className="font-bold">{data.label || 'End'}</div>
      <Handle
        type="target"
        position={Position.Top}
        className="w-2 h-2 bg-red-500"
      />
    </div>
  );
});
