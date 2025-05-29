"use client";

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { GitBranch } from 'lucide-react';

export const ConditionNode = memo(({ data }: NodeProps) => {
  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-white border-2 border-yellow-500 min-w-[200px]">
      <div className="flex items-center">
        <GitBranch className="h-4 w-4 mr-2 text-yellow-500" />
        <div className="font-bold">{data.label || 'Condition'}</div>
      </div>
      {data.variable && (
        <div className="mt-2 text-xs text-gray-700 border-t pt-2">
          <div className="font-mono truncate max-w-[250px]">
            {data.variable} {data.operator} {data.value}
          </div>
        </div>
      )}
      <Handle
        type="target"
        position={Position.Top}
        className="w-2 h-2 bg-yellow-500"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        className="w-2 h-2 bg-red-500 left-[25%]"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        className="w-2 h-2 bg-green-500 left-[75%]"
      />
    </div>
  );
});
