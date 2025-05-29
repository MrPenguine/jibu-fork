"use client";

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { ListFilter } from 'lucide-react';

export const ChoiceNode = memo(({ data }: NodeProps) => {
  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-white border-2 border-orange-500 min-w-[200px]">
      <div className="flex items-center">
        <ListFilter className="h-4 w-4 mr-2 text-orange-500" />
        <div className="font-bold">{data.label || 'Choice'}</div>
      </div>
      {data.message && (
        <div className="mt-2 text-xs text-gray-700 border-t pt-2 max-w-[250px] truncate">
          {data.message}
        </div>
      )}
      {data.choices && data.choices.length > 0 && (
        <div className="mt-2 text-xs text-gray-700 border-t pt-2">
          <div className="font-semibold mb-1">Choices:</div>
          <ul className="list-disc list-inside">
            {data.choices.map((choice, index) => (
              <li key={index} className="truncate max-w-[250px]">
                {choice.label}
              </li>
            ))}
          </ul>
        </div>
      )}
      <Handle
        type="target"
        position={Position.Top}
        className="w-2 h-2 bg-orange-500"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-2 h-2 bg-orange-500"
      />
    </div>
  );
});
