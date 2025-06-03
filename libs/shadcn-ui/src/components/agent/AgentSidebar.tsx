"use client";

import React from 'react';
import { Button } from '../ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import { AgentNodeType } from '../../types';
import { 
  MessageCircle, 
  MousePointer, 
  GitBranch, 
  Code as CodeIcon, 
  FileText as FileTextIcon, 
  Image as ImageIcon, 
  GalleryHorizontal, 
  ListChecks, 
  GitFork, 
  BrainCircuit, 
  Network, 
  FunctionSquare,
  Zap,
  MessageSquare,
  Cog,
  Bot,
  Component,
  Terminal,
  Search,
  Database,
  BookOpen,
  Settings,
  PenTool,
  Variable,
  Code,
  Globe,
  Code2,
  Wrench,
  Puzzle
} from 'lucide-react';

// Sidebar navigation items with node types and their colors
const sidebarNavItems = [
  {
    id: 'agent',
    label: 'Agent',
    icon: Bot,
    color: 'slate',
    items: [
      { id: 'agent_message', label: 'Message', icon: MessageCircle, type: AgentNodeType.MESSAGE },
      { id: 'agent_prompt', label: 'Prompt', icon: PenTool, type: AgentNodeType.SET_VARIABLE },
    ],
  },
  {
    id: 'talk',
    label: 'Talk',
    icon: MessageSquare,
    color: 'blue',
    items: [
      { id: 'message', label: 'Message', icon: MessageCircle, type: AgentNodeType.MESSAGE },
      { id: 'prompt', label: 'Prompt', icon: BrainCircuit, type: AgentNodeType.SET_VARIABLE },
      { id: 'image', label: 'Image', icon: ImageIcon, type: AgentNodeType.MESSAGE },
      { id: 'card', label: 'Card', icon: FileTextIcon, type: AgentNodeType.MESSAGE },
      { id: 'carousel', label: 'Carousel', icon: GalleryHorizontal, type: AgentNodeType.MESSAGE },
    ],
  },
  {
    id: 'listen',
    label: 'Listen',
    icon: Zap,
    color: 'green',
    items: [
      { id: 'buttons', label: 'Buttons', icon: MousePointer, type: AgentNodeType.CHOICE },
      { id: 'choice', label: 'Choice', icon: ListChecks, type: AgentNodeType.CHOICE },
      { id: 'capture', label: 'Capture', icon: Zap, type: AgentNodeType.LISTEN },
    ],
  },
  {
    id: 'logic',
    label: 'Logic',
    icon: GitBranch,
    color: 'yellow',
    items: [
      { id: 'condition', label: 'Condition', icon: GitBranch, type: AgentNodeType.CONDITION },
      { id: 'set', label: 'Set Variable', icon: Variable, type: AgentNodeType.SET_VARIABLE },
      { id: 'javascript', label: 'JavaScript', icon: Code, type: AgentNodeType.CUSTOM },
    ],
  },
  {
    id: 'dev',
    label: 'Dev',
    icon: Cog,
    items: [
      { id: 'start', label: 'Start', icon: GitBranch, type: AgentNodeType.START },
      { id: 'end', label: 'End', icon: MessageCircle, type: AgentNodeType.END },
      { id: 'function', label: 'Function', icon: Terminal, type: AgentNodeType.TOOL_CALL },
      { id: 'api', label: 'API', icon: Network, type: AgentNodeType.API_CALL },
      { id: 'javascript', label: 'Javascript', icon: CodeIcon, type: AgentNodeType.SET_VARIABLE },
      { id: 'kb_search', label: 'KB search', icon: Search, type: AgentNodeType.TOOL_CALL },
      { id: 'custom_action', label: 'Custom action', icon: Settings, type: AgentNodeType.TOOL_CALL },
    ],
  },
  {
    id: 'library',
    label: 'Library',
    icon: BookOpen,
    items: [
      { id: 'saved_components', label: 'Saved Components', icon: Component, type: AgentNodeType.SET_VARIABLE },
      { id: 'templates', label: 'Templates', icon: FileTextIcon, type: AgentNodeType.SET_VARIABLE },
    ],
  },
];

interface AgentSidebarProps {
  onAddNode: (nodeType: AgentNodeType, label: string) => void;
  onDragStart: (event: React.DragEvent<HTMLElement>, nodeType: AgentNodeType, label: string) => void;
  activePopover: string | null;
  setActivePopover: (id: string | null) => void;
}

export function AgentSidebar({ 
  onAddNode, 
  onDragStart, 
  activePopover, 
  setActivePopover 
}: AgentSidebarProps) {
  return (
    <div className="w-16 border-r border-slate-200 bg-white flex flex-col items-center py-4 space-y-4 shrink-0">
      {sidebarNavItems.map((section) => (
        <Popover 
          key={section.id} 
          open={activePopover === section.id} 
          onOpenChange={(open) => setActivePopover(open ? section.id : null)}
        >
          <div 
            onMouseEnter={() => setActivePopover(section.id)}
            onMouseLeave={() => setActivePopover(null)}
          >
            <PopoverTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                className={`w-12 h-12 rounded-lg flex flex-col items-center justify-center space-y-1 ${
                  activePopover === section.id 
                    ? `bg-${section.color || 'slate'}-100` 
                    : ''
                }`}
              >
                <section.icon className={`h-5 w-5 ${section.color ? `text-${section.color}-500` : ''}`} /> 
                <span className="text-xs">{section.label}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent 
              side="right" 
              align="start" 
              className={`w-48 p-0 ml-2 shadow-xl rounded-lg border-slate-200 overflow-hidden`}
              onMouseEnter={() => setActivePopover(section.id)}
              onMouseLeave={() => setActivePopover(null)}
              sideOffset={5}
              hideWhenDetached={false}
            >
              <div className={`flex flex-col gap-1`}>
                <div className={`p-2 bg-${section.color || 'slate'}-100 border-b border-${section.color || 'slate'}-200 mb-1`}>
                  <div className="flex items-center">
                    <section.icon className={`h-4 w-4 mr-2 ${section.color ? `text-${section.color}-500` : ''}`} />
                    <span className="font-medium text-sm">{section.label}</span>
                  </div>
                </div>
                <div className="p-2">
                  {section.items.map((item) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => onDragStart(e, item.type as AgentNodeType, item.label)}
                    className="cursor-grab hover:bg-slate-100 rounded-md transition-all duration-200 group"
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="justify-start text-sm w-full hover:bg-transparent focus:bg-transparent"
                      type="button"
                    >
                      <div className="flex items-center w-full">
                        <item.icon className="mr-2 h-4 w-4 flex-shrink-0 group-hover:opacity-50" />
                        <span className="flex-grow">{item.label}</span>
                        <svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          width="16" 
                          height="16" 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="2" 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 ml-2"
                        >
                          <path d="M14 4a2 2 0 1 0-4 0a2 2 0 0 0 4 0z"/>
                          <path d="M14 12a2 2 0 1 0-4 0a2 2 0 0 0 4 0z"/>
                          <path d="M14 20a2 2 0 1 0-4 0a2 2 0 0 0 4 0z"/>
                          <path d="M4 4a2 2 0 1 0-4 0a2 2 0 0 0 4 0z"/>
                          <path d="M4 12a2 2 0 1 0-4 0a2 2 0 0 0 4 0z"/>
                          <path d="M4 20a2 2 0 1 0-4 0a2 2 0 0 0 4 0z"/>
                          <path d="M24 4a2 2 0 1 0-4 0a2 2 0 0 0 4 0z"/>
                          <path d="M24 12a2 2 0 1 0-4 0a2 2 0 0 0 4 0z"/>
                          <path d="M24 20a2 2 0 1 0-4 0a2 2 0 0 0 4 0z"/>
                        </svg>
                      </div>
                    </Button>
                  </div>
                ))}
                </div>
              </div>
            </PopoverContent>
          </div>
        </Popover>
      ))}
    </div>
  );
}
