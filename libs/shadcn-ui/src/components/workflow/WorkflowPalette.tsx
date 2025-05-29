"use client";

import React from 'react';
import { WorkflowNodeType } from '../../../../../libs/src';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Separator } from '../ui/separator';

// Node type groups for better organization
const nodeGroups = [
  {
    title: 'Basic',
    types: [
      { type: WorkflowNodeType.START, label: 'Start', description: 'Starting point of the workflow' },
      { type: WorkflowNodeType.END, label: 'End', description: 'End point of the workflow' },
    ],
  },
  {
    title: 'Conversation',
    types: [
      { type: WorkflowNodeType.MESSAGE, label: 'Message', description: 'Send a message to the user' },
      { type: WorkflowNodeType.LISTEN, label: 'Listen', description: 'Wait for user input' },
      { type: WorkflowNodeType.CHOICE, label: 'Choice', description: 'Present choices to the user' },
    ],
  },
  {
    title: 'Logic',
    types: [
      { type: WorkflowNodeType.CONDITION, label: 'Condition', description: 'Branch based on a condition' },
      { type: WorkflowNodeType.SET_VARIABLE, label: 'Set Variable', description: 'Set a workflow variable' },
    ],
  },
  {
    title: 'Integration',
    types: [
      { type: WorkflowNodeType.API_CALL, label: 'API Call', description: 'Make an HTTP request' },
      { type: WorkflowNodeType.TOOL_CALL, label: 'Tool Call', description: 'Execute a tool' },
    ],
  },
  {
    title: 'Voice',
    types: [
      { type: WorkflowNodeType.TRANSFER, label: 'Transfer', description: 'Transfer to another endpoint' },
      { type: WorkflowNodeType.RECORD, label: 'Record', description: 'Record audio' },
      { type: WorkflowNodeType.PLAY_AUDIO, label: 'Play Audio', description: 'Play an audio file' },
    ],
  },
];

export const WorkflowPalette: React.FC = () => {
  // Handle drag start
  const onDragStart = (event: React.DragEvent, nodeType: WorkflowNodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <Card className="w-64">
      <CardHeader className="py-3">
        <CardTitle className="text-sm font-medium">Node Palette</CardTitle>
      </CardHeader>
      <CardContent className="p-2">
        {nodeGroups.map((group, groupIndex) => (
          <React.Fragment key={group.title}>
            {groupIndex > 0 && <Separator className="my-2" />}
            <div className="mb-2">
              <h3 className="text-xs font-semibold text-muted-foreground mb-1">{group.title}</h3>
              <div className="grid grid-cols-2 gap-1">
                {group.types.map((nodeType) => (
                  <div
                    key={nodeType.type}
                    className="p-2 border rounded-md text-xs cursor-move bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
                    draggable
                    onDragStart={(event) => onDragStart(event, nodeType.type)}
                    title={nodeType.description}
                  >
                    {nodeType.label}
                  </div>
                ))}
              </div>
            </div>
          </React.Fragment>
        ))}
      </CardContent>
    </Card>
  );
};
