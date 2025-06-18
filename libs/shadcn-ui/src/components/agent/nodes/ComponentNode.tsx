"use client";

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Component } from 'lucide-react';

export const ComponentNode = memo(({ data, selected }: NodeProps) => {
  const handleTestClick = (event: React.MouseEvent) => {
    // Stop propagation to prevent node selection
    event.stopPropagation();
    
    // Call the onTest callback if provided
    if (data.onTest) {
      data.onTest(data.id);
    }
  };
  
  return (
    <div className="shadow-sm rounded-lg bg-pink-50 min-w-[200px] overflow-hidden">
      {/* Block title with play button */}
      <div className="px-4 py-2 text-sm font-medium text-pink-700 flex justify-between items-center bg-pink-100">
        <div>New Block {data.blockNumber || 12}</div>
        <button 
          onClick={handleTestClick}
          className="h-5 w-5 flex items-center justify-center rounded-full hover:bg-pink-200 transition-colors"
          title="Test this node"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-pink-600">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        </button>
      </div>
      
      {/* Block content */}
      <div className="p-3">
        <div className="bg-white rounded-md p-3 flex items-center space-x-2 border border-pink-200">
          <Component className="h-5 w-5 text-pink-500" />
          <div className="text-sm text-pink-700">Component</div>
        </div>
        
        {data.componentType && (
          <div className="mt-2 px-1 text-xs text-pink-700">
            <div className="font-medium">Type: {data.componentType}</div>
            {data.props && (
              <div className="mt-1">
                <div className="font-medium">Props:</div>
                <div className="truncate max-w-[250px] font-mono">
                  {typeof data.props === 'object' 
                    ? JSON.stringify(data.props).substring(0, 50) + (JSON.stringify(data.props).length > 50 ? '...' : '')
                    : String(data.props)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <Handle
        type="target"
        position={Position.Top}
        className="w-2 h-2 bg-pink-500"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-2 h-2 bg-pink-500"
      />
    </div>
  );
});
