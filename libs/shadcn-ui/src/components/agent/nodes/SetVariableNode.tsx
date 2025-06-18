"use client";

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Variable } from 'lucide-react';

export const SetVariableNode = memo(({ data, selected }: NodeProps) => {
  const handleTestClick = (event: React.MouseEvent) => {
    // Stop propagation to prevent node selection
    event.stopPropagation();
    
    // Call the onTest callback if provided
    if (data.onTest) {
      data.onTest(data.id);
    }
  };
  
  return (
    <div className="shadow-sm rounded-lg bg-yellow-50 min-w-[200px] overflow-hidden">
      {/* Block title with play button */}
      <div className="px-4 py-2 text-sm font-medium text-yellow-700 flex justify-between items-center bg-yellow-100">
        <div>New Block {data.blockNumber || 7}</div>
        <button 
          onClick={handleTestClick}
          className="h-5 w-5 flex items-center justify-center rounded-full hover:bg-yellow-200 transition-colors"
          title="Test this node"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-600">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        </button>
      </div>
      
      {/* Block content */}
      <div className="p-3">
        <div className="bg-white rounded-md p-3 flex items-center space-x-2 border border-yellow-200">
          <Variable className="h-5 w-5 text-yellow-500" />
          <div className="text-sm text-yellow-700">Set Variable</div>
        </div>
        
        {data.assignments && data.assignments.length > 0 && (
          <div className="mt-2 px-1 text-xs text-yellow-700">
            <div className="font-medium mb-1">Assignments:</div>
            <ul className="list-disc list-inside">
              {data.assignments.map((assignment: { variableName: string; value: any }, index: number) => (
                <li key={index} className="truncate max-w-[250px] font-mono text-yellow-700">
                  {assignment.variableName} = {typeof assignment.value === 'object' 
                    ? JSON.stringify(assignment.value).substring(0, 20) + '...' 
                    : String(assignment.value).substring(0, 20) + (String(assignment.value).length > 20 ? '...' : '')}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <Handle
        type="target"
        position={Position.Top}
        className="w-2 h-2 bg-yellow-500"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-2 h-2 bg-yellow-500"
      />
    </div>
  );
});
