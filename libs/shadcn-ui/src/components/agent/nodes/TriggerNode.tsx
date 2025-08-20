"use client";

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Zap } from 'lucide-react';

export const TriggerNode = memo(({ id, data, selected }: NodeProps) => {
  return (
    <div
      className={`inline-flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-900 rounded-full text-white font-medium text-sm cursor-pointer transition-colors group ${selected ? 'ring-2 ring-gray-400/60' : ''}`}
    >
      {/* Hidden right-side handle (source), vertically centered */}
      <Handle
        id="out"
        type="source"
        position={Position.Right}
        className="w-2 h-2 opacity-0 bg-transparent"
        style={{ right: -6, top: '50%', transform: 'translateY(-50%)' }}
        isValidConnection={(connection) => connection.target !== id}
      />

      <Zap className="w-4 h-4" />
      <span>Add trigger...</span>
      <div className="w-2 h-2 bg-white rounded-full ml-1" />
    </div>
  );
});
