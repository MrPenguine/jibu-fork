"use client";

import React from 'react';
import { AgentNodeType } from '../../../../src';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Separator } from '../ui/separator';

// Node type groups for better organization
const nodeGroups = [
  {
    title: 'Basic',
    types: [
      { type: AgentNodeType.START, label: 'Start', description: 'Starting point of the agent' },
      { type: AgentNodeType.END, label: 'End', description: 'End point of the agent' },
    ],
  },
  {
    title: 'Assistants',
    types: [
      { type: AgentNodeType.ASSISTANT, label: 'Assistant', description: 'Represents an AI assistant' },
    ],
  },
  {
    title: 'Conversation',
    types: [
      // { type: AgentNodeType.MESSAGE, label: 'Message', description: 'Send a message to the user' }, // Removed
      { type: AgentNodeType.LISTEN, label: 'Listen', description: 'Wait for user input' },
      { type: AgentNodeType.CHOICE, label: 'Choice', description: 'Present choices to the user' },
    ],
  },
  {
    title: 'Logic',
    types: [
      { type: AgentNodeType.CONDITION, label: 'Condition', description: 'Branch based on a condition' },
      { type: AgentNodeType.SET_VARIABLE, label: 'Set Variable', description: 'Set a agent variable' },
    ],
  },
  {
    title: 'Integration',
    types: [
      { type: AgentNodeType.API_CALL, label: 'API Call', description: 'Make an HTTP request' },
      { type: AgentNodeType.TOOL_CALL, label: 'Tool Call', description: 'Execute a tool' },
    ],
  },
  {
    title: 'Voice',
    types: [
      { type: AgentNodeType.TRANSFER, label: 'Transfer', description: 'Transfer to another endpoint' },
      { type: AgentNodeType.RECORD, label: 'Record', description: 'Record audio' },
      { type: AgentNodeType.PLAY_AUDIO, label: 'Play Audio', description: 'Play an audio file' },
    ],
  },
];

export const AgentPalette: React.FC = () => {
  // Handle drag start
  const onDragStart = (event: React.DragEvent, nodeType: AgentNodeType) => {
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
