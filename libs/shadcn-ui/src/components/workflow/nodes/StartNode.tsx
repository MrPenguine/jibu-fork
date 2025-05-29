"use client";

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

export const StartNode = memo(({ data }: NodeProps) => {
  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-white border-2 border-green-500 min-w-[150px] text-center">
      <div className="font-bold">{data.label || 'Start'}</div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-2 h-2 bg-green-500"
      />
    </div>
  );
});
