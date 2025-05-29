"use client";

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Wrench } from 'lucide-react';

export const ToolCallNode = memo(({ data }: NodeProps) => {
  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-white border-2 border-indigo-500 min-w-[200px]">
      <div className="flex items-center">
        <Wrench className="h-4 w-4 mr-2 text-indigo-500" />
        <div className="font-bold">{data.label || 'Tool Call'}</div>
      </div>
      {data.toolId && (
        <div className="mt-2 text-xs text-gray-700 border-t pt-2">
          <div className="font-semibold">Tool ID:</div>
          <div className="truncate max-w-[250px] font-mono">{data.toolId}</div>
          {data.outputVariableName && (
            <div className="mt-1">
              Store in: <span className="font-mono">{data.outputVariableName}</span>
            </div>
          )}
        </div>
      )}
      <Handle
        type="target"
        position={Position.Top}
        className="w-2 h-2 bg-indigo-500"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-2 h-2 bg-indigo-500"
      />
    </div>
  );
});
