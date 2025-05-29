"use client";

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Globe } from 'lucide-react';

export const ApiCallNode = memo(({ data }: NodeProps) => {
  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-white border-2 border-blue-500 min-w-[200px]">
      <div className="flex items-center">
        <Globe className="h-4 w-4 mr-2 text-blue-500" />
        <div className="font-bold">{data.label || 'API Call'}</div>
      </div>
      {data.url && (
        <div className="mt-2 text-xs text-gray-700 border-t pt-2">
          <div className="font-semibold">{data.method || 'GET'}</div>
          <div className="truncate max-w-[250px] font-mono">{data.url}</div>
          {data.responseVariableName && (
            <div className="mt-1">
              Store in: <span className="font-mono">{data.responseVariableName}</span>
            </div>
          )}
        </div>
      )}
      <Handle
        type="target"
        position={Position.Top}
        className="w-2 h-2 bg-blue-500"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-2 h-2 bg-blue-500"
      />
    </div>
  );
});
