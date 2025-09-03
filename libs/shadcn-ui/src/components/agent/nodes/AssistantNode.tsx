"use client";

import React, { memo, useState, useEffect, useCallback } from 'react';
import { NodeProps } from 'reactflow';
import { AgentNodeType } from '../../../types';
import { User } from 'lucide-react';
import { PillNodeShell } from './PillNodeShell';
import { getAssistantById as fetchAssistant } from '../../../../../../apps/frontend/src/utils/assistants-min';

// Define an Assistant interface to match what we get from the API
interface Assistant {
  id: string;
  name: string;
  firstMessage?: string;
  systemPrompt?: string;
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
  color?: string;
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
      const details = await fetchAssistant(apiAssistantId);

      if (!details || !details.id) {
        throw new Error('Received invalid assistant data from API');
      }

      // Map v1 assistant details (assistants-min) into node data
      const mappedProvider = details.llmProvider ? String(details.llmProvider).toLowerCase() : model?.provider;
      const updatedData = {
        name: details.name || name,
        systemMessage: details.systemPrompt || systemMessage,
        firstMessage: (details as any).description || firstMessage || '',
        model: {
          provider: mappedProvider || 'openai',
          model: details.llmModel || model?.model || 'gpt-4-turbo',
          temperature: details.metadata?.temperature ?? model?.temperature ?? 0.7,
          maxTokens: details.metadata?.maxTokens ?? model?.maxTokens ?? 2048,
          preference: model?.preference || 'balance'
        },
        apiAssistantId: apiAssistantId,
      };

      if (onNodeDataChange) {
        onNodeDataChange(updatedData);
      }

      // Store a minimal copy locally for display convenience, including systemPrompt
      setAssistantData({
        id: details.id,
        name: details.name,
        firstMessage: (details as any).description,
        systemPrompt: (details as any).systemPrompt,
      } as any);
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
  const displaySystemMessage = assistantData?.systemPrompt || systemMessage;
  
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

  // No fixed dimensions; rely on PillNodeShell sizing

  return (
    <PillNodeShell
      id={id}
      selected={selected}
      nodeTitle={nodeTitle}
      roleTitle={roleTitle}
      description={isLoading ? 'Loading...' : (error ? 'Error loading data' : (displaySystemMessage || truncatedFirstMessage))}
      Icon={User}
      blockNumber={blockNumber}
      onTest={(nodeId) => data.onTest?.(nodeId)}
      onDoubleClick={handleDoubleClick}
      includeRightHandle
      themeColor={(data as any)?.color}
    />
  );
});

AssistantNode.displayName = 'AssistantNode';
