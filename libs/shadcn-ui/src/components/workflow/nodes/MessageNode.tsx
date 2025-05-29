"use client";

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { MessageSquare } from 'lucide-react';

export const MessageNode = memo(({ data }: NodeProps) => {
  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-white border-2 border-blue-500 min-w-[200px]">
      <div className="flex items-center">
        <MessageSquare className="h-4 w-4 mr-2 text-blue-500" />
        <div className="font-bold">{data.label || 'Message'}</div>
      </div>
      {data.message && (
        <div className="mt-2 text-xs text-gray-700 border-t pt-2 max-w-[250px] truncate">
          {data.message}
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
