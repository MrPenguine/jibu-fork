"use client";

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Ear } from 'lucide-react';

export const ListenNode = memo(({ data, selected }: NodeProps) => {
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
        <div>New Block {data.blockNumber || 2}</div>
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
          <Ear className="h-5 w-5 text-green-500" />
          <div className="text-sm text-green-700">Listen for user input</div>
        </div>
        
        {data.variableName && (
          <div className="mt-2 px-1 text-xs text-green-700">
            Variable: <span className="font-mono">{data.variableName}</span>
          </div>
        )}
      </div>
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 rounded-full bg-green-500 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 rounded-full bg-green-500 border-2 border-white"
      />
    </div>
  );
});
