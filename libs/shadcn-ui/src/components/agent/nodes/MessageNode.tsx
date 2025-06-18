"use client";

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { MessageSquare } from 'lucide-react';

export const MessageNode = memo(({ data, selected }: NodeProps) => {
  const handleTestClick = (event: React.MouseEvent) => {
    // Stop propagation to prevent node selection
    event.stopPropagation();
    
    // Call the onTest callback if provided
    if (data.onTest) {
      data.onTest(data.id);
    }
  };
  
  return (
    <div className="shadow-sm rounded-lg bg-blue-50 min-w-[200px] overflow-hidden">
      {/* Block title with play button */}
      <div className="px-4 py-2 text-sm font-medium text-blue-700 flex justify-between items-center bg-blue-100">
        <div>New Block {data.blockNumber || 3}</div>
        <button 
          onClick={handleTestClick}
          className="h-5 w-5 flex items-center justify-center rounded-full hover:bg-blue-200 transition-colors"
          title="Test this node"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        </button>
      </div>
      
      {/* Block content */}
      <div className="p-3">
        <div className="bg-white rounded-md p-3 flex items-center space-x-2 border border-blue-200">
          <MessageSquare className="h-5 w-5 text-blue-500" />
          <div className="text-sm text-blue-700">{data.message || 'Select agent'}</div>
        </div>
      </div>
      
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white"
      />
    </div>
  );
});
