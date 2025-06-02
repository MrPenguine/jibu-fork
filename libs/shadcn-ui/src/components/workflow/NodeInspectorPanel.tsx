"use client";

import React from 'react';
import { FlowNode } from '../../types';
import { Button } from '../ui/button';
import { WorkflowNodeInspector } from './WorkflowNodeInspector';

interface NodeInspectorPanelProps {
  selectedNode: FlowNode | null;
  onNodeUpdate: (nodeId: string, data: any) => void;
  onClose: () => void;
  assistantId?: string;
}

export function NodeInspectorPanel({ 
  selectedNode, 
  onNodeUpdate, 
  onClose,
  assistantId 
}: NodeInspectorPanelProps) {
  if (!selectedNode) return null;

  return (
    <div className="absolute top-0 right-0 w-80 h-full bg-white shadow-lg border-l border-slate-100 overflow-y-auto">
      {/* Header with close button */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-medium text-slate-700">Block settings</h3>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={onClose}
          className="h-6 w-6 p-0 rounded-full hover:bg-slate-100"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          <span className="sr-only">Close</span>
        </Button>
      </div>
      
      {/* Content area with padding */}
      <div className="p-4">
        <WorkflowNodeInspector 
          node={selectedNode} 
          onUpdate={onNodeUpdate}
          assistantId={assistantId}
        />
      </div>
    </div>
  );
}
