"use client";

import React, { memo, useState, useEffect, useCallback, useRef } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { AgentNodeType } from '../../../types'; // Adjusted path based on types.ts location
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
    onNodeDataChange,
    // xPos and yPos are not in data, they are top-level props in NodeProps
  } = data;

  // Track the last fetched assistant ID to prevent redundant API calls
  const lastFetchedAssistantIdRef = useRef<string | null>(null);
  const isInitialMountRef = useRef(true);
  const processedKnowledgeBaseIdRef = useRef<string | null | undefined>(undefined); // undefined: never processed, null: processed for 'no KB'
  const { addNodes, getNodes, addEdges, getEdges, getNode, setEdges } = useReactFlow(); // Added setEdges
  // xPos and yPos are part of NodeProps (passed directly to AssistantNode), not in data. 
  // The new useEffect for KB node addition correctly uses getNode(id).position.

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
    // If apiAssistantId is cleared (e.g. node is duplicated or reset), clear fetched data
    if (!apiAssistantId) {
      setAssistantData(null);
      lastFetchedAssistantIdRef.current = null; // Reset ref to allow fetching if an ID is later set
      return;
    }
    fetchAssistantData();
  }, [apiAssistantId, fetchAssistantData, id]);

  // Effect to automatically add and connect KnowledgeBaseSearchNode
  useEffect(() => {
    // Determine current KB ID, treating undefined as null for consistent comparison
    const currentKnowledgeBaseId = assistantData?.knowledgeBaseId || data.knowledgeBaseId || null;
    const assistantNodeId = id;

    // If we've already processed this exact knowledgeBaseId, we might not need to do anything.
    if (currentKnowledgeBaseId === processedKnowledgeBaseIdRef.current) {
      // However, check if the edge actually exists. If not, we should allow re-creation.
      if (currentKnowledgeBaseId) {
        const expectedKbNodeId = `kb-search-for-${assistantNodeId}`;
        const edgeId = `edge-${assistantNodeId}-to-${expectedKbNodeId}`;
        const edgeExists = getEdges().some(e => e.id === edgeId);
        console.log(`[AssistantNode ${id}] Ref check: KB ${currentKnowledgeBaseId}. Edge ${edgeId} exists in getEdges(): ${edgeExists}. Current getEdges() IDs:`, getEdges().map(e => e.id));
        if (edgeExists) {
          // console.log(`[AssistantNode ${id}] KB ${currentKnowledgeBaseId} already processed and edge ${edgeId} exists. Returning.`);
          return; // Already processed and edge is present, nothing to do.
        }
        console.log(`[AssistantNode ${id}] Ref check: KB ${currentKnowledgeBaseId} was processed, but edge ${edgeId} is missing. Allowing re-creation.`);
      } else {
        // console.log(`[AssistantNode ${id}] No KB to process, and 'no KB' state was already processed.`);
        return; // No KB, and we've already handled this state.
      }
    }

    // Proceed with node/edge creation or handling 'no KB' state
    console.log(`[AssistantNode ${id}] Processing KB ID: ${currentKnowledgeBaseId} (Previous: ${processedKnowledgeBaseIdRef.current})`);

    if (currentKnowledgeBaseId && assistantNodeId) {
      const expectedKbNodeId = `kb-search-for-${assistantNodeId}`;
      const existingKbNode = getNode(expectedKbNodeId);
      const existingEdge = getEdges().find(
        (edge) =>
          edge.source === assistantNodeId &&
          edge.sourceHandle === 'kb-connection' &&
          edge.target === expectedKbNodeId &&
          edge.targetHandle === 'kb-connection-target'
      );

      const currentNode = getNode(assistantNodeId);

      if (currentNode && (!existingKbNode || !existingEdge)) {
        const assistantNodeWidth = currentNode.width || 280; // Default width from AssistantNode
        const newNodeX = currentNode.position.x + assistantNodeWidth + 75;
        const newNodeY = currentNode.position.y; // Align vertically

        if (!existingKbNode) {
          const newNodeToAdd = {
            id: expectedKbNodeId,
            type: AgentNodeType.KNOWLEDGE_BASE_SEARCH as string, // Cast enum to string
            position: { x: newNodeX, y: newNodeY },
            data: {
              knowledgeBaseId: currentKnowledgeBaseId,
              knowledgeBaseName: assistantData?.name
                ? `KB for ${assistantData.name}`
                : currentKnowledgeBaseId,
              // Automatically connect this KB node to the current assistant
              // This helps the KB node itself know which assistant it's linked to if needed
              connectedAssistantId: data.apiAssistantId 
            },
          };
          addNodes([newNodeToAdd]);
        }

        if (!existingEdge) {
          const newEdgeToAdd = {
            id: `edge-${assistantNodeId}-to-${expectedKbNodeId}`,
            source: assistantNodeId,
            sourceHandle: 'kb-connection',
            target: expectedKbNodeId,
            targetHandle: 'kb-connection-target',
            type: 'smoothstep',
          };
          // Use addEdges from useReactFlow() to ensure it goes through the central onEdgesChange handler
          // which has more robust de-duplication logic.
          console.log(`[AssistantNode ${id}] Edge ${newEdgeToAdd.id} determined to be MISSING based on 'existingEdge' variable. 'existingEdge' was:`, existingEdge, `Calling addEdges. Current getEdges() IDs before call:`, getEdges().map(e => e.id));
          addEdges([newEdgeToAdd]);
        } else {
          console.log(`[AssistantNode ${id}] Edge ${newEdgeToAdd.id} determined to be PRESENT based on 'existingEdge' variable. 'existingEdge' was:`, existingEdge, `Skipping addEdges. Current getEdges() IDs:`, getEdges().map(e => e.id));
        }
      }
    }

    // Update the ref to reflect that this currentKnowledgeBaseId has now been processed.
    processedKnowledgeBaseIdRef.current = currentKnowledgeBaseId;

  }, [
    assistantData?.knowledgeBaseId,
    data.knowledgeBaseId, 
    id, 
    addNodes, 
    getNodes, 
    addEdges, // Keep addEdges if used elsewhere, or remove if setEdges covers all uses from here
    getNode, 
    setEdges, 
    getEdges, // Added getEdges to dependencies
  ]);

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
      data-type="assistantNode"
      data-node-type="assistantNode"
    >
      {/* Top handle for connection - this accepts connections from other nodes but not itself */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-blue-500/80"
        isValidConnection={(connection) => connection.source !== id}
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

      {/* Bottom handle for connection - prevent connecting to itself */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-blue-500/80"
        isValidConnection={(connection) => connection.target !== id}
      />

      {/* Right side handle - specifically for connecting to KnowledgeBase Search */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-green-500/80 hover:bg-green-700 transition-colors"
        id="kb-connection"
        style={{ cursor: 'pointer' }}
        isValidConnection={(connection) => {
          // Be more permissive about connections - only prevent self-connections
          // We'll leave the visual feedback to guide users instead of blocking connections
          return connection.target !== id;
        }}
        data-tooltip="Knowledge Base Connection"
        onMouseEnter={(e) => {
          // Create tooltip element when hovering
          const tooltip = document.createElement('div');
          tooltip.textContent = 'Knowledge Base Connection';
          tooltip.style.position = 'absolute';
          tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
          tooltip.style.color = 'white';
          tooltip.style.padding = '5px 10px';
          tooltip.style.borderRadius = '4px';
          tooltip.style.fontSize = '12px';
          tooltip.style.zIndex = '1000';
          tooltip.style.top = `${e.clientY - 40}px`;
          tooltip.style.left = `${e.clientX}px`;
          tooltip.classList.add('kb-connection-tooltip-assistant');
          document.body.appendChild(tooltip);
        }}
        onMouseLeave={() => {
          // Remove tooltip when not hovering
          const tooltip = document.querySelector('.kb-connection-tooltip-assistant');
          if (tooltip) {
            document.body.removeChild(tooltip);
          }
        }}
      />
    </div>
  );
});

AssistantNode.displayName = 'AssistantNode';
