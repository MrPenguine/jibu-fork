"use client";

import React, { memo, useState, useEffect, useCallback, useRef } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Bot, PlayCircle } from 'lucide-react';
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
  systemMessage?: string;
  firstMessage?: string;
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
  onNodeDoubleClick?: (event: React.MouseEvent, nodeId: string) => void;
  onNodeDataChange?: (updatedData: Partial<AssistantNodeData>) => void;
  onSave?: (updatedData: Partial<AssistantNodeData>) => void;
  onTest?: (nodeId: string) => void;
}

export const AssistantNode = memo<NodeProps<AssistantNodeData>>(({ id, data, selected }) => {
  console.log(`[AssistantNode ${id}] Initial data prop:`, JSON.stringify(data, null, 2));

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
    knowledgeBaseId,
    onNodeDoubleClick,
    onTest,
    onSave,
    onNodeDataChange
  } = data;

  // Track the last fetched assistant ID to prevent redundant API calls
  const lastFetchedAssistantIdRef = useRef<string | null>(null);
  const isInitialMountRef = useRef(true);

  // Memoize the fetchAssistantData function to prevent recreation on every render
  const fetchAssistantData = useCallback(async () => {
    if (!apiAssistantId) {
      console.warn(`[AssistantNode ${id}] No apiAssistantId provided, skipping fetch`);
      return;
    }

    // Skip if we've already fetched this assistant ID (prevents redundant API calls)
    if (lastFetchedAssistantIdRef.current === apiAssistantId && !isInitialMountRef.current) {
      console.log(`[AssistantNode ${id}] Already fetched assistant ID: ${apiAssistantId}, skipping duplicate fetch`);
      return;
    }

    console.log(`[AssistantNode ${id}] Fetching assistant data for ID: ${apiAssistantId}`);
    setIsLoading(true);
    setError(null);

    try {
      // Make API call to fetch assistant data with more detailed logging
      console.log(`[AssistantNode ${id}] About to call fetchAssistant API for ID: ${apiAssistantId}`);
      const assistant = await fetchAssistant(apiAssistantId);
      
      // Check if we got valid data back
      if (!assistant || !assistant.id) {
        console.error(`[AssistantNode ${id}] Received invalid assistant data:`, assistant);
        throw new Error('Received invalid assistant data from API');
      }
      
      console.log(`[AssistantNode ${id}] Successfully fetched assistant data:`, JSON.stringify(assistant, null, 2));
      
      // Update local state
      setAssistantData(assistant);
      
      // Prepare the updated node data with all necessary fields
      const updatedData = {
        name: assistant.name,
        systemMessage: assistant.voicemailMessage || systemMessage,
        firstMessage: assistant.firstMessage || firstMessage || '',
        knowledgeBaseId: assistant.knowledgeBaseId || knowledgeBaseId,
        model: {
          provider: assistant.model?.provider || model?.provider || 'openai',
          model: assistant.model?.model || model?.model || 'gpt-4-turbo',
          temperature: assistant.model?.temperature ?? model?.temperature ?? 0.7,
          maxTokens: assistant.model?.maxTokens ?? model?.maxTokens ?? 2048,
          preference: assistant.model?.preference || model?.preference || 'balance'
        },
        apiAssistantId: apiAssistantId, // Ensure we keep the apiAssistantId
        organizationId: (assistant as any)?.organizationId || ''
      };
      
      console.log(`[AssistantNode ${id}] Updating node data with:`, JSON.stringify(updatedData, null, 2));
      
      // Update our ref to track that we've fetched this assistant
      lastFetchedAssistantIdRef.current = apiAssistantId;
      
      // Notify parent component of the data change
      if (onNodeDataChange) {
        console.log(`[AssistantNode ${id}] Calling onNodeDataChange with updated data`);
        onNodeDataChange(updatedData);
      } else {
        console.warn(`[AssistantNode ${id}] No onNodeDataChange callback provided`);
      }
      
      // Also call onSave if provided (for backward compatibility)
      if (onSave) {
        console.log(`[AssistantNode ${id}] Calling onSave with updated data`);
        onSave(updatedData);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[AssistantNode ${id}] Failed to fetch assistant:`, errorMessage, err);
      setError(`Failed to load assistant: ${errorMessage}`);
      
      // Log more details about the error for debugging
      console.error(`[AssistantNode ${id}] Error details:`, err);
      console.error(`[AssistantNode ${id}] API Assistant ID that failed:`, apiAssistantId);
    } finally {
      setIsLoading(false);
      isInitialMountRef.current = false;
    }
  }, [apiAssistantId, id, systemMessage, firstMessage, knowledgeBaseId, model]);  

  // Fetch assistant data when the component mounts or apiAssistantId changes
  useEffect(() => {
    // Only fetch when we have an apiAssistantId
    if (apiAssistantId) {
      console.log(`[AssistantNode ${id}] Triggering fetch for assistant ID: ${apiAssistantId}`);
      fetchAssistantData();
    }
  }, [apiAssistantId, fetchAssistantData]); 

  // Get data from either the fetched assistant or the local data
  const displayName = assistantData?.name || name;
  const displayFirstMessage = assistantData?.firstMessage || firstMessage || '';
  const displaySystemMessage = assistantData?.voicemailMessage || systemMessage;
  const displayKnowledgeBaseId = assistantData?.knowledgeBaseId || knowledgeBaseId;
  
  // Debug knowledge base ID
  console.log(`[AssistantNode ${id}] Knowledge Base ID:`, displayKnowledgeBaseId);
  const hasVoice = !!(assistantData?.voice?.voiceId);
  
  // Get model information from assistantData with fallback to local data
  const modelProvider = assistantData?.model?.provider || model?.provider || 'openai';
  const modelName = assistantData?.model?.model || model?.model || 'gpt-4-turbo';
  
  // Format model label correctly based on provider
  let modelLabel;
  if (modelProvider === 'openai') {
    modelLabel = `/${modelName}`;
  } else if (modelProvider === 'anthropic') {
    modelLabel = `/anthropic-${modelName}`;
  } else if (modelProvider === 'google') {
    // Special handling for Google/Gemini models
    modelLabel = `/gemini-${modelName}`;
  } else if (modelProvider === 'jais') {
    // Special handling for JAIS models
    modelLabel = `/jais-${modelName}`;
  } else if (modelProvider === 'mistral') {
    // Special handling for Mistral models
    modelLabel = `/mistral-${modelName}`;
  } else {
    // For any other provider
    modelLabel = `/${modelProvider}-${modelName}`;
  }
  
  // Calculate truncated first message for display
  const truncatedFirstMessage = displayFirstMessage && displayFirstMessage.length > 75
    ? displayFirstMessage.substring(0, 75) + '...'
    : displayFirstMessage;

  // Handle double-click to open node inspector
  const handleDoubleClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    
    // If onNodeDoubleClick is provided, call it
    if (onNodeDoubleClick) {
      onNodeDoubleClick(event, id);
    }
  }, [id, onNodeDoubleClick]);

  // Test handler for the play button
  const handleTest = () => {
    if (onTest) {
      onTest(id);
    }
  };

  // Format creation date if available
  const createdDate = assistantData?.createdAt ? 
    new Date(assistantData.createdAt).toLocaleDateString() : null;

  // Fixed dimensions
  const defaultWidth = 280;
  const defaultHeight = 150;
  
  return (
    <div 
      className={`shadow-md rounded-md bg-blue-50 overflow-hidden ${selected ? 'ring-2 ring-blue-500' : ''}`}
      style={{ 
        width: defaultWidth,
        height: defaultHeight
      }}
      onDoubleClick={handleDoubleClick}
    >
      {/* Top handle for connection */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-blue-500/80"
      />

      {/* Header with name and test button */}
      <div className="flex items-center justify-between p-3 border-b border-blue-100 bg-blue-100">
        <div className="font-medium text-blue-800 flex items-center gap-2">
          <Bot className="h-5 w-5" /> 
          {displayName}
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              handleTest();
            }} 
            className="text-blue-600 hover:text-blue-800 transition-colors"
          >
            <PlayCircle className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Normal view with assistant information */}
      <div className="p-3 flex flex-col gap-3 bg-white">
        {/* First message / description */}
        <div className="text-sm text-gray-600">
          {isLoading ? 'Loading...' : error ? 'Error loading data' : truncatedFirstMessage}
        </div>
        
        {/* Tags and identifiers */}
        <div className="flex flex-wrap gap-2">
          {/* Model tag */}
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-md">
            {modelLabel}
          </span>
          
          {/* Voice enabled tag */}
          {hasVoice && (
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-md">
              Voice Enabled
            </span>
          )}
          
          {/* Knowledge base tag - always show if there's any value */}
          {displayKnowledgeBaseId !== null && displayKnowledgeBaseId !== undefined && displayKnowledgeBaseId !== '' && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-md">
              Knowledge Base
            </span>
          )}
        </div>
        
        {/* Creation date */}
        {createdDate && (
          <div className="text-xs text-gray-500 mt-1">
            Created {createdDate}
          </div>
        )}
        
        {/* Assistant ID - small and subtle at the bottom */}
        {apiAssistantId && (
          <div className="text-xs text-gray-400 font-mono mt-1">
            ID: {apiAssistantId}
          </div>
        )}
      </div>

      {/* Bottom handle for connection */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-blue-500/80"
      />
    </div>
  );
});

AssistantNode.displayName = 'AssistantNode';
