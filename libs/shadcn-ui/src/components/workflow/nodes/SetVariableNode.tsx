"use client";

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Variable } from 'lucide-react';

export const SetVariableNode = memo(({ data }: NodeProps) => {
  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-white border-2 border-green-500 min-w-[200px]">
      <div className="flex items-center">
        <Variable className="h-4 w-4 mr-2 text-green-500" />
        <div className="font-bold">{data.label || 'Set Variable'}</div>
      </div>
      {data.assignments && data.assignments.length > 0 && (
        <div className="mt-2 text-xs text-gray-700 border-t pt-2">
          <div className="font-semibold mb-1">Assignments:</div>
          <ul className="list-disc list-inside">
            {data.assignments.map((assignment, index) => (
              <li key={index} className="truncate max-w-[250px] font-mono">
                {assignment.variableName} = {typeof assignment.value === 'object' 
                  ? JSON.stringify(assignment.value).substring(0, 20) + '...' 
                  : String(assignment.value).substring(0, 20) + (String(assignment.value).length > 20 ? '...' : '')}
              </li>
            ))}
          </ul>
        </div>
      )}
      <Handle
        type="target"
        position={Position.Top}
        className="w-2 h-2 bg-green-500"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-2 h-2 bg-green-500"
      />
    </div>
  );
});
