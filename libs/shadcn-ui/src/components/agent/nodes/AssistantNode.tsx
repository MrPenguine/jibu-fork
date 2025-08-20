"use client";

import React, { memo, useState, useEffect, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { AgentNodeType } from '../../../types';
import { User, Play } from 'lucide-react';
import { Card } from '../../ui/card';
import { getAssistant as fetchAssistant } from '../../../../../../apps/frontend/src/utils/AssistantsApi';

// Define an Assistant interface to match what we get from the API
interface Assistant {
  id: string;
  name: string;
  firstMessage?: string;
  voicemailMessage?: string;
  knowledgeBaseId?: string | null;
  model?: {
    provider?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    preference?: 'latency' | 'balance' | 'capability';
  };
  voice?: {
    provider?: string;
    voiceId?: string;
  };
  hipaaEnabled?: boolean;
  createdAt?: string;
}

// Define the expected data structure for AssistantNode
export interface AssistantNodeData {
  id?: string; // Optional, as React Flow provides the node ID, but useful if we tie to a backend Assistant ID
  apiAssistantId?: string; // To store the actual ID from the backend API
  name?: string;
  nodeTitle?: string; // Title displayed at the top of the node
  role?: string; // Displayed as bold heading inside the card
  systemMessage?: string;
  firstMessage?: string;
  blockNumber?: number;
  model?: {
    provider?: string;
    model?: string; // Specific model identifier, e.g., 'gpt-4-turbo'
    temperature?: number;
    maxTokens?: number;
    preference?: 'latency' | 'balance' | 'capability';
  };
  knowledgeBaseId?: string | null;
  organizationId?: string;
  voice?: {
    provider?: string;
    voiceId?: string;
  };
  listenForIntents?: boolean; // Whether to listen for other intents
  exitConversation?: boolean; // Whether to exit every conversational turn
  onNodeDoubleClick?: (event: React.MouseEvent, nodeId: string) => void;
  onNodeDataChange?: (updatedData: Partial<AssistantNodeData>) => void;
  onSave?: (updatedData: Partial<AssistantNodeData>) => void;
  onTest?: (nodeId: string) => void;
}

export const AssistantNode = memo<NodeProps<AssistantNodeData>>(({ id, data, selected }) => {
  // State to hold the fetched assistant data
  const [assistantData, setAssistantData] = useState<Assistant | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extract the key properties from node data
  const { 
    apiAssistantId,
    name = 'Assistant', 
    systemMessage = 'I am a helpful assistant.', 
    firstMessage,
    model,
    onNodeDoubleClick,
    onNodeDataChange,
    // xPos and yPos are not in data, they are top-level props in NodeProps
  } = data;

  // Memoize the fetchAssistantData function to prevent recreation on every render
  const fetchAssistantData = useCallback(async () => {
    if (!apiAssistantId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const assistant = await fetchAssistant(apiAssistantId);
      
      if (!assistant || !assistant.id) {
        throw new Error('Received invalid assistant data from API');
      }
      
      setAssistantData(assistant);
      
      const updatedData = {
        name: assistant.name,
        systemMessage: assistant.voicemailMessage || systemMessage,
        firstMessage: assistant.firstMessage || firstMessage || '',
        model: {
          provider: assistant.model?.provider || model?.provider || 'openai',
          model: assistant.model?.model || model?.model || 'gpt-4-turbo',
          temperature: assistant.model?.temperature ?? model?.temperature ?? 0.7,
          maxTokens: assistant.model?.maxTokens ?? model?.maxTokens ?? 2048,
          preference: assistant.model?.preference || model?.preference || 'balance'
        },
        apiAssistantId: apiAssistantId,
        organizationId: (assistant as any)?.organizationId || ''
      };
      
      if (onNodeDataChange) {
        onNodeDataChange(updatedData);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to load assistant: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, [apiAssistantId, id, systemMessage, firstMessage, model]);

  // Fetch assistant data when the component mounts or apiAssistantId changes
  useEffect(() => {
    if (!apiAssistantId) {
      setAssistantData(null);
      return;
    }
    fetchAssistantData();
  }, [apiAssistantId, fetchAssistantData]);

  // Get data from either the fetched assistant or the local data
  const displayName = assistantData?.name || name;
  const displayFirstMessage = assistantData?.firstMessage || firstMessage || '';
  const displaySystemMessage = assistantData?.voicemailMessage || systemMessage;
  
  // Calculate truncated first message for display
  const truncatedFirstMessage = displayFirstMessage && displayFirstMessage.length > 75
    ? displayFirstMessage.substring(0, 75) + '...'
    : displayFirstMessage;
    
  // Node title (like "Customer support" in the example)
  const nodeTitle = data.nodeTitle || `New Block${typeof data.blockNumber === 'number' ? ` ${data.blockNumber}` : ''}`;
  const roleTitle = data.role || data.name || 'Assistant';
  const blockNumber = data.blockNumber;

  // Handle double-click to open node inspector
  const handleDoubleClick = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    console.log('[AssistantNode] Double-clicked!', id);
    
    // If onNodeDoubleClick is provided, call it
    if (onNodeDoubleClick) {
      onNodeDoubleClick(event, id);
    } else {
      console.log('[AssistantNode] Warning: No double-click handler provided');
    }
  }, [id, onNodeDoubleClick]);

  // No fixed dimensions; rely on utility classes for sizing
  
  return (
    <div 
      className={`w-96 p-4 bg-slate-200/50 rounded-2xl border border-slate-300/50 group hover:bg-slate-200/70 transition-colors cursor-pointer ${selected ? 'ring-2 ring-slate-400' : ''}`}
      onDoubleClick={handleDoubleClick}
      data-type="assistantNode"
      data-node-type="assistantNode"
    >
      {/* Hidden left handle (target), vertically centered */}
      <Handle
        id="in"
        type="target"
        position={Position.Left}
        className="w-2 h-2 opacity-0 bg-transparent"
        style={{ left: -6, top: '50%', transform: 'translateY(-50%)' }}
        isValidConnection={(connection) => connection.source !== id}
      />

      {/* Header with hover Play */}
      <div className="mb-3 relative">
        <h3 className="text-slate-600 font-medium text-sm">{nodeTitle}</h3>
        <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <div
            className="w-4 h-4 bg-slate-400 rounded-sm flex items-center justify-center"
            onClick={(e) => {
              e.stopPropagation();
              if (data.onTest) data.onTest(id);
            }}
            role="button"
            aria-label="Test block"
          >
            <Play className="w-2.5 h-2.5 text-white" />
          </div>
        </div>
      </div>

      {/* Content Card */}
      <Card className="p-4 bg-white border-slate-200 shadow-sm">
        <div className="flex items-start gap-3">
          {/* User Icon */}
          <div className="flex-shrink-0 mt-0.5">
            <div className="w-5 h-5 rounded bg-slate-100 flex items-center justify-center">
              <User className="w-3 h-3 text-slate-600" />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-slate-900 text-sm mb-1">{roleTitle}</h4>
            <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
              {isLoading
                ? 'Loading...'
                : error
                ? 'Error loading data'
                : (displaySystemMessage || truncatedFirstMessage)}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
});

AssistantNode.displayName = 'AssistantNode';
