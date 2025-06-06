"use client";

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { ListFilter } from 'lucide-react';

export const ChoiceNode = memo(({ id, data, selected }: NodeProps) => {
  const handleTestClick = (event: React.MouseEvent) => {
    // Stop propagation to prevent node selection
    event.stopPropagation();
    
    // Call the onTest callback if provided
    if (data.onTest) {
      data.onTest(data.id);
    }
  };
  
  return (
    <div className="shadow-sm rounded-lg bg-green-50 min-w-[200px] overflow-hidden">
      {/* Block title with play button */}
      <div className="px-4 py-2 text-sm font-medium text-green-700 flex justify-between items-center bg-green-100">
        <div>New Block {data.blockNumber || 4}</div>
        <button 
          onClick={handleTestClick}
          className="h-5 w-5 flex items-center justify-center rounded-full hover:bg-green-200 transition-colors"
          title="Test this node"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        </button>
      </div>
      
      {/* Block content */}
      <div className="p-3">
        <div className="bg-white rounded-md p-3 flex items-center space-x-2 border border-green-200">
          <ListFilter className="h-5 w-5 text-green-500" />
          <div className="text-sm text-green-700">Present choices to user</div>
        </div>
        
        {data.choices && data.choices.length > 0 && (
          <div className="mt-2 px-1 text-xs text-green-700">
            <div className="font-medium mb-1">Choices:</div>
            <ul className="list-disc list-inside">
              {data.choices.map((choice: { label: string; value: string }, index: number) => (
                <li key={index} className="truncate max-w-[250px] text-green-700">
                  {choice.label}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 rounded-full bg-green-500 border-2 border-white"
        isValidConnection={(connection) => connection.source !== id} // Prevent connecting to itself
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 rounded-full bg-green-500 border-2 border-white"
        isValidConnection={(connection) => connection.target !== id} // Prevent connecting to itself
      />
    </div>
  );
});
