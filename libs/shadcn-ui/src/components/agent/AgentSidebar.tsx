"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import { AgentNodeType } from '../../types';
import { useAssistants, Assistant } from '../../../../../apps/frontend/src/utils/AssistantsApi'; // Adjusted path
import type { LucideIcon } from 'lucide-react'; // Import LucideIcon type
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

// Base structure for sidebar navigation items
// The 'Assistants' section will be populated dynamically
const baseSidebarNavItems = [
  {
    id: 'assistants',
    label: 'Assistants',
    icon: Bot, // Changed icon to Bot for the main category
    color: 'slate',
    items: [], // This will be populated dynamically by fetched assistants
    isDynamic: true, // Flag to indicate dynamic items
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
      { id: 'kb_search', label: 'KB search', icon: Search, type: AgentNodeType.KNOWLEDGE_BASE_SEARCH },
      { id: 'tool', label: 'Tool', icon: Wrench, type: AgentNodeType.TOOL_CALL },
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
  onAddNode: (nodeType: AgentNodeType, label: string) => void; // This might need adjustment if adding nodes directly without drag
  onDragStart: (event: React.DragEvent<HTMLElement>, nodeType: AgentNodeType, data: { label: string } | PopulatedSidebarItem['assistantData']) => void;
  activePopover: string | null;
  setActivePopover: (id: string | null) => void;
}

// Define a more specific type for sidebar items after dynamic population
interface PopulatedSidebarItem {
  id: string;
  label: string;
  icon: LucideIcon; // Lucide icons are components
  type: AgentNodeType;
  assistantData?: {
    apiAssistantId: string;
    name: string;
    systemMessage: string;
    model?: Assistant['model']; // Use the model object type from Assistant
    knowledgeBaseId?: string | null;
  };
  apiAssistantId?: string;
  name?: string;
  systemMessage?: string;
  model?: Assistant['model'];
  knowledgeBaseId?: string | null;
}

interface PopulatedSidebarSection {
  id: string;
  label: string;
  icon: LucideIcon;
  color?: string; // Made color optional
  items: PopulatedSidebarItem[];
  isDynamic?: boolean;
}

// Cache key prefix for localStorage
const ASSISTANTS_CACHE_KEY_PREFIX = 'jibu_assistants_cache_';
const ASSISTANTS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

// Helper function to retrieve cached assistants
function getCachedAssistants(orgId: string): any[] | null {
  if (typeof window === 'undefined') return null; // Check if we're in the browser
  
  try {
    const cacheKey = `${ASSISTANTS_CACHE_KEY_PREFIX}${orgId}`;
    const cachedData = localStorage.getItem(cacheKey);
    
    if (!cachedData) return null;
    
    const { data, timestamp } = JSON.parse(cachedData);
    const now = Date.now();
    
    // Check if cache is still valid (not expired)
    if (now - timestamp < ASSISTANTS_CACHE_TTL) {
      console.log(`[AgentSidebar] Using cached assistants data (${data.length} items)`);
      return data;
    } else {
      console.log(`[AgentSidebar] Cache expired, will fetch fresh data`);
      localStorage.removeItem(cacheKey);
      return null;
    }
  } catch (error) {
    console.error('[AgentSidebar] Error reading from cache:', error);
    return null;
  }
}

// Helper function to store assistants in cache
function cacheAssistants(orgId: string, data: any[]) {
  if (typeof window === 'undefined') return; // Check if we're in the browser
  
  try {
    const cacheKey = `${ASSISTANTS_CACHE_KEY_PREFIX}${orgId}`;
    const cacheData = {
      data,
      timestamp: Date.now()
    };
    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    console.log(`[AgentSidebar] Cached ${data.length} assistants for organization ${orgId}`);
  } catch (error) {
    console.error('[AgentSidebar] Error writing to cache:', error);
  }
}

export function AgentSidebar({ 
  onAddNode, 
  onDragStart, 
  activePopover, 
  setActivePopover 
}: AgentSidebarProps) {
  // Use the assistants hook - only get the organization ID and the fetch function
  const { getAssistants, organizationId } = useAssistants();
  
  // Local state for assistants data, loading, and error
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [isLoadingAssistants, setIsLoadingAssistants] = useState(false);
  const [assistantsError, setAssistantsError] = useState<Error | null>(null);

  const [sidebarNavItems, setSidebarNavItems] = useState<PopulatedSidebarSection[]>(baseSidebarNavItems);

  // Effect to fetch assistants only when organizationId changes
  useEffect(() => {
    // Skip if no organizationId is available
    if (!organizationId) {
      setAssistants([]);
      setIsLoadingAssistants(false);
      return;
    }
    
    // Attempt to use cached data first
    const cachedAssistantData = getCachedAssistants(organizationId);
    if (cachedAssistantData) {
      setAssistants(cachedAssistantData);
      setIsLoadingAssistants(false);
      return;
    }
    
    // Set loading state and fetch fresh data
    setIsLoadingAssistants(true);
    
    // Fetch assistants data
    console.log(`[AgentSidebar] Fetching assistants for organization: ${organizationId}`);
    getAssistants()
      .then(data => {
        console.log(`[AgentSidebar] Successfully loaded ${data?.length || 0} assistants`);
        setAssistants(data || []);
        
        // Cache the fetched data
        if (data && data.length > 0) {
          cacheAssistants(organizationId, data);
        }
      })
      .catch(error => {
        console.error('[AgentSidebar] Error fetching assistants:', error);
        setAssistantsError(error);
        setAssistants([]); // Set to empty array on error
      })
      .finally(() => {
        setIsLoadingAssistants(false);
      });
    
    // Only depend on organizationId
  }, [organizationId]);

  // Effect to update sidebarNavItems when assistants data changes
  useEffect(() => {
    if (assistants) {
      const dynamicItems = assistants.map((assistant: Assistant) => ({
        id: assistant.id,
        label: assistant.name,
        icon: Bot, // Using Bot icon for individual assistants too
        type: AgentNodeType.ASSISTANT,
        assistantData: {
          apiAssistantId: assistant.id,
          name: assistant.name,
          systemMessage: assistant.description || assistant.voicemailMessage || assistant.firstMessage || '',
          model: assistant.model || { provider: 'openai', model: 'gpt-4-turbo', temperature: 0.7, maxTokens: 2048, preference: 'balance' },
          knowledgeBaseId: assistant.knowledgeBaseId,
        },
      }));

      setSidebarNavItems(prevItems => 
        prevItems.map(section => 
          section.id === 'assistants' ? { ...section, items: dynamicItems } : section
        )
      );
    } else if (!isLoadingAssistants) {
        // If not loading and assistants is undefined/null (e.g. initial state or error without data)
        // ensure the assistants section is empty
        setSidebarNavItems(prevItems => 
            prevItems.map(section => 
              section.id === 'assistants' ? { ...section, items: [] } : section
            )
          );
    }
  }, [assistants, isLoadingAssistants]);
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
                  {(section.id === 'assistants' && isLoadingAssistants) ? (
                    <div className="p-2 text-sm text-slate-500">Loading assistants...</div>
                  ) : section.items.length === 0 && section.id === 'assistants' ? (
                    <div className="p-2 text-sm text-slate-500">No assistants found.</div>
                  ) : (
                    section.items.map((item: PopulatedSidebarItem) => (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={(e) => {
                          // Prepare the data to be transferred via drag and drop
                          // For assistant nodes, ensure we have the apiAssistantId
                          // Create a properly typed assistantData object
                          const assistantData: any = item.assistantData ? { ...item.assistantData } : { 
                            name: item.label, 
                            systemMessage: '', 
                            model: { model: 'default-model', provider: 'openai' } 
                          };
                          
                          // Ensure apiAssistantId is included if this is an assistant
                          if (item.type === AgentNodeType.ASSISTANT && item.apiAssistantId) {
                            assistantData.apiAssistantId = item.apiAssistantId;
                            console.log(`[AgentSidebar] Dragging assistant with apiAssistantId: ${item.apiAssistantId}`);
                          }
                          
                          const dragData = {
                            type: item.type as AgentNodeType,
                            assistantData: assistantData
                          };
                          
                          // Log the drag data for debugging
                          console.log(`[AgentSidebar] Drag data:`, JSON.stringify(dragData, null, 2));
                          
                          // Set the data for ReactFlow to use on drop
                          e.dataTransfer.setData('application/reactflow', JSON.stringify(dragData));
                          
                          // Pass only strings to the parent component to avoid React rendering issues
                          if (typeof onDragStart === 'function') {
                            // Use just the label as a string to avoid React trying to render objects
                            onDragStart(e, item.type as AgentNodeType, assistantData);
                          }
                        }}
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
                            {/* Draggable icon hint */}
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
                              <circle cx="12" cy="12" r="10" />
                              <line x1="12" y1="8" x2="12" y2="16" />
                              <line x1="8" y1="12" x2="16" y2="12" />
                            </svg>
                          </div>
                        </Button>
                      </div>
                    ))
                  )
                }
                </div>
              </div>
            </PopoverContent>
          </div>
        </Popover>
      ))}
    </div>
  );
}
