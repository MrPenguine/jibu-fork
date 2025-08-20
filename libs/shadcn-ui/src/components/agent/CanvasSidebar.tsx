"use client";

import React from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../components/ui/popover';
import { Button } from '../../components/ui/button';
import {
  MessageSquare,
  Mic,
  GitBranch,
  Cpu,
  Share,
  Play,
  StopCircle,
  Puzzle,
  Bot,
  Code,
  ArrowRight,
  Search,
  Variable,
} from 'lucide-react';
import { Separator } from '../../components/ui/separator';
import { AgentNodeType } from '../../types';

interface NodePaletteItemProps {
  icon: React.ElementType;
  label: string;
  nodeType: string;
  onDragStart: (event: React.DragEvent, nodeType: string) => void;
  colorClass: string;
}

const NodePaletteItem: React.FC<NodePaletteItemProps> = ({
  icon: Icon,
  label,
  nodeType,
  onDragStart,
  colorClass,
}) => (
  <div
    className={`flex items-center p-2 rounded-md border border-transparent hover:border-gray-300 hover:bg-gray-50 cursor-grab transition-all duration-150 ${colorClass}`}
    onDragStart={(event) => onDragStart(event, nodeType)}
    draggable
  >
    <Icon className="h-5 w-5 mr-3" />
    <span className="font-medium text-sm">{label}</span>
  </div>
);

interface AgentSidebarProps {
  onDragStart: (event: React.DragEvent, nodeType: string, data?: any) => void;
  activePopover: string | null;
  setActivePopover: (popoverId: string | null) => void;
}

export const AgentSidebar: React.FC<AgentSidebarProps> = ({
  onDragStart,
  activePopover,
  setActivePopover,
}) => {
  const nodeCategories = [
    {
      id: 'agent',
      label: 'Agent',
      icon: Bot,
      color: 'bg-slate-50 text-slate-700',
      nodes: [
        { type: AgentNodeType.START, label: 'Start', icon: Play },
        { type: AgentNodeType.END, label: 'End', icon: StopCircle },
        { type: AgentNodeType.ASSISTANT, label: 'Assistant', icon: Bot },
      ],
    },
    {
      id: 'talk',
      label: 'Talk',
      icon: MessageSquare,
      color: 'bg-blue-50 text-blue-700',
      nodes: [
        { type: AgentNodeType.MESSAGE, label: 'Message', icon: MessageSquare },
      ],
    },
    {
      id: 'listen',
      label: 'Listen',
      icon: Mic,
      color: 'bg-green-50 text-green-700',
      nodes: [
        { type: AgentNodeType.LISTEN, label: 'Listen', icon: Mic },
        { type: AgentNodeType.CHOICE, label: 'Choice', icon: Share },
      ],
    },
    {
      id: 'logic',
      label: 'Logic',
      icon: GitBranch,
      color: 'bg-yellow-50 text-yellow-700',
      nodes: [
        { type: AgentNodeType.CONDITION, label: 'Condition', icon: GitBranch },
        { type: AgentNodeType.SET_VARIABLE, label: 'Set Variable', icon: Variable },
        { type: AgentNodeType.CUSTOM, label: 'JavaScript', icon: Code },
      ],
    },
    {
      id: 'integrations',
      label: 'Integrations',
      icon: Cpu,
      color: 'bg-indigo-50 text-indigo-700',
      nodes: [
        { type: AgentNodeType.TOOL_CALL, label: 'Tool Call', icon: Puzzle },
        { type: AgentNodeType.API_CALL, label: 'API Call', icon: Share },
        { type: AgentNodeType.KNOWLEDGE_BASE_SEARCH, label: 'KB Search', icon: Search },
        { type: AgentNodeType.N8N_INTEGRATION, label: 'n8n Integration', icon: Cpu },
      ],
    },
  ];

  return (
    <div className="absolute top-4 left-20 z-10 bg-white border border-gray-200 rounded-lg shadow-lg p-1 w-16 flex flex-col gap-1">
      <div className="flex flex-col gap-1 py-2">
        {nodeCategories.map((category) => (
          <Popover key={category.id} onOpenChange={(isOpen) => setActivePopover(isOpen ? category.id : null)}>
            <PopoverTrigger asChild>
              <Button variant="ghost" className="w-full h-12 p-2 flex items-center justify-center" title={category.label}>
                <category.icon className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="right" align="start" className="w-64 p-2">
              <div className={`p-2 rounded-t-md ${category.color}`}>
                <h3 className="font-semibold">{category.label}</h3>
              </div>
              <div className="flex flex-col gap-2 p-2">
                {category.nodes.map((node) => (
                  <NodePaletteItem
                    key={node.type}
                    icon={node.icon}
                    label={node.label}
                    nodeType={node.type}
                    onDragStart={onDragStart}
                    colorClass={category.color}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>
        ))}
      </div>
    </div>
  );
};