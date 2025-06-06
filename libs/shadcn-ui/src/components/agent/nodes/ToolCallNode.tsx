"use client";

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Wrench } from 'lucide-react';

export const ToolCallNode = memo(({ data, selected }: NodeProps) => {
  const handleTestClick = (event: React.MouseEvent) => {
    // Stop propagation to prevent node selection
    event.stopPropagation();
    
    // Call the onTest callback if provided
    if (data.onTest) {
      data.onTest(data.id);
    }
  };
  
  return (
    <div 
      className="shadow-sm rounded-lg bg-slate-50 min-w-[200px] overflow-hidden"
      data-tool-name={data.toolName || ''}
      data-node-type="toolCallNode"
      data-type="toolCallNode"
    >
      {/* Block title with play button */}
      <div className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 flex justify-between items-center">
        <div>{data.toolName || `Tool Call ${data.blockNumber || ''}`}</div>
        <button 
          onClick={handleTestClick}
          className="h-5 w-5 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors"
          title="Test this node"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        </button>
      </div>
      
      {/* Block content */}
      <div className="p-3">
        <div className="bg-white rounded-md p-3 flex items-center space-x-2 border border-slate-200">
          <Wrench className="h-5 w-5 text-slate-500" />
          <div className="text-sm text-slate-700">Tool Call</div>
        </div>
        
        {data.toolId && (
          <div className="mt-2 px-1 text-xs text-slate-700">
            <div className="font-medium">Tool ID:</div>
            <div className="truncate max-w-[250px] font-mono text-slate-700">{data.toolId}</div>
            {data.outputVariableName && (
              <div className="mt-1">
                Store in: <span className="font-mono">{data.outputVariableName}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Standard handles for Tool Call node */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-2 h-2 bg-slate-500"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-2 h-2 bg-slate-500"
      />
    </div>
  );
});
