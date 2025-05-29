"use client";

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Ear } from 'lucide-react';

export const ListenNode = memo(({ data }: NodeProps) => {
  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-white border-2 border-purple-500 min-w-[200px]">
      <div className="flex items-center">
        <Ear className="h-4 w-4 mr-2 text-purple-500" />
        <div className="font-bold">{data.label || 'Listen'}</div>
      </div>
      {data.variableName && (
        <div className="mt-2 text-xs text-gray-700 border-t pt-2">
          Store in: <span className="font-mono">{data.variableName}</span>
        </div>
      )}
      <Handle
        type="target"
        position={Position.Top}
        className="w-2 h-2 bg-purple-500"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-2 h-2 bg-purple-500"
      />
    </div>
  );
});
