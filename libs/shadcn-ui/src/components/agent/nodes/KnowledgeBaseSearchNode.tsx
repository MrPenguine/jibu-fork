"use client";

import React, { memo, useCallback, useState, useEffect } from 'react';
import { Handle, Position, NodeProps, useReactFlow, useUpdateNodeInternals, useEdges, useNodeId, useNodes } from 'reactflow';
import { AgentNodeType } from '../../../../src';
import { KnowledgeBaseConfig } from '../../assistants/KnowledgeBaseConfig';
import { Card } from '../../ui/card';
import { Alert, AlertDescription } from '../../ui/alert';
import { AlertCircle, Search, Settings } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { Button } from '../../ui/button';

export interface KnowledgeBaseSearchNodeData {
  id?: string;
  blockNumber?: number;
  knowledgeBaseId?: string;
  knowledgeBaseName?: string;
  query?: string;
  outputVariableName?: string;
  onTest?: (nodeId: string) => void;
  onUpdateBlockData?: (nodeId: string, data: Partial<KnowledgeBaseSearchNodeData>) => void;
  connectedAssistantId?: string;
  _connectionTimestamp?: number; // Added to track connection changes
}

// Defining a type for our node with settings panel support
export type NodeWithSettingsPanel = {
  renderBlockSettings?: () => React.ReactNode;
};

export const KnowledgeBaseSearchNode = memo(({ id, data, selected }: NodeProps<KnowledgeBaseSearchNodeData>) => {
  const updateNodeInternals = useUpdateNodeInternals();
  const reactFlow = useReactFlow();
  const [connectedAssistantId, setConnectedAssistantId] = useState<string | null>(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  
  // Get all edges to determine if this node is connected to an assistant node
  const edges = useEdges();
  const nodes = useNodes();
  const nodeId = useNodeId();
  
  // Find connected assistant node (if any)
  useEffect(() => {
    const connectedEdges = edges.filter(edge => edge.target === nodeId);
    if (connectedEdges.length > 0) {
      // Find the source node of the connected edge
      const sourceNodeId = connectedEdges[0].source;
      const sourceNode = nodes.find(node => node.id === sourceNodeId);
      
      // If the source node is an assistant node, store its ID
      if (sourceNode && sourceNode.type === 'ASSISTANT' && sourceNode.data) {
        const nodeData = sourceNode.data as any;
        // Look for apiAssistantId (from backend) or regular id
        const assistantId = nodeData.apiAssistantId || nodeData.id;
        if (assistantId) {
          setConnectedAssistantId(assistantId);
          
          // Also update the node data to store the connection
          if (data.onUpdateBlockData && data.connectedAssistantId !== assistantId) {
            data.onUpdateBlockData(id, {
              connectedAssistantId: assistantId,
              _connectionTimestamp: Date.now()
            });
          }
        }
      }
    } else {
      // If there's no connection, clear the connected assistant ID
      setConnectedAssistantId(null);
      
      // Also update the node data to clear the connection
      if (data.onUpdateBlockData && data.connectedAssistantId) {
        data.onUpdateBlockData(id, {
          connectedAssistantId: undefined,
          _connectionTimestamp: Date.now()
        });
      }
    }
  }, [edges, nodes, nodeId, id, data, data.onUpdateBlockData]);

  const handleTestClick = (event: React.MouseEvent) => {
    // Stop propagation to prevent node selection
    event.stopPropagation();

    // Call the onTest callback if it exists
    if (data.onTest) {
      data.onTest(id);
    }
  };
  
  // Handle double click to open the config modal
  const handleDoubleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    setIsConfigModalOpen(true);
  };
  
  // Handle knowledge base selection from the config component
  const handleKnowledgeBaseChange = useCallback(
    (knowledgeBaseId: string | null, knowledgeBaseName?: string) => {
      // Update this node's knowledge base ID and name
      if (data.onUpdateBlockData) {
        data.onUpdateBlockData(id, {
          knowledgeBaseId: knowledgeBaseId || undefined,
          knowledgeBaseName: knowledgeBaseName || undefined
        });
      }
      
      // If this node is connected to an assistant, we need to link the knowledge base to the assistant
      if (connectedAssistantId && knowledgeBaseId) {
        console.log(`Linking knowledge base ${knowledgeBaseId} to assistant ${connectedAssistantId}`);
        // The actual API call will be handled by KnowledgeBaseConfig component
      }
    },
    [id, connectedAssistantId, data.onUpdateBlockData]
  );
  
  // Function to handle saving output variable name
  const handleOutputVariableChange = (value: string) => {
    if (data.onUpdateBlockData) {
      data.onUpdateBlockData(id, { outputVariableName: value });
    }
  };
  
  // Function to handle saving query
  const handleQueryChange = (value: string) => {
    if (data.onUpdateBlockData) {
      data.onUpdateBlockData(id, { query: value });
    }
  };
  
  const renderBlockSettings = () => {
    return (
      <Card className="p-4 flex flex-col gap-2">
        <div className="text-lg font-medium">Node Properties: Knowledge Base Search</div>
        
        {/* Knowledge Base Selection */}
        <div className="space-y-1">
          <div className="font-medium">Knowledge Base</div>
          
          {data.knowledgeBaseId ? (
            <div className="mb-2">
              <div className="font-medium text-sm">{data.knowledgeBaseName}</div>
              <div className="text-xs text-gray-500">{data.knowledgeBaseId}</div>
            </div>
          ) : (
            <div className="text-sm text-amber-600 mb-2">
              No knowledge base selected
            </div>
          )}
          
          <Button 
            variant="outline" 
            className="w-full flex justify-center items-center gap-2"
            onClick={() => setIsConfigModalOpen(true)}
          >
            <Settings className="h-4 w-4" /> Edit Configuration
          </Button>
        </div>
        
        <div className="mt-4 p-2 border border-gray-100 rounded bg-gray-50">
          <div className="text-sm font-medium">Output Settings</div>
          <div className="text-xs text-gray-500 mt-1">
            Search results will be stored in the workflow variable.
          </div>
        </div>
      </Card>
    );
  };
  
  // Expose the renderBlockSettings function to the parent component
  (KnowledgeBaseSearchNode as any).renderBlockSettings = renderBlockSettings;
  
  // Render the config modal
  const renderConfigModal = () => {
    return (
      <Dialog open={isConfigModalOpen} onOpenChange={setIsConfigModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Knowledge Base Configuration</DialogTitle>
            <DialogDescription>
              Configure the knowledge base for this search node.
            </DialogDescription>
          </DialogHeader>
          
          {!connectedAssistantId ? (
            <div className="my-4">
              <Alert className="bg-yellow-50 border-yellow-200">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-600">
                  This node must be connected to an Assistant node before selecting a knowledge base.
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <div className="py-4">
              <KnowledgeBaseConfig 
                assistantId={connectedAssistantId}
                knowledgeBaseId={data.knowledgeBaseId}
                onKnowledgeBaseChange={handleKnowledgeBaseChange}
                maxFileHeight={8}
                showEditControls={true}
              />
            </div>
          )}
          
          <div className="mt-4 flex justify-end">
            <Button onClick={() => setIsConfigModalOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  };
  
  // Render the main component
  return (
    <>
      <div 
        className="shadow-sm rounded-lg bg-purple-50 min-w-[200px] overflow-hidden" 
        data-node-type={AgentNodeType.KNOWLEDGE_BASE_SEARCH}
        data-type="knowledgeBaseSearchNode"
        data-has-settings="true"
        style={{
          boxShadow: data.knowledgeBaseName ? '0 0 0 2px rgba(139, 92, 246, 0.4)' : 'none'
        }}
        onDoubleClick={handleDoubleClick}
      >
      {/* Block title with play button */}
      <div className="px-4 py-2 text-sm font-medium text-purple-700 flex justify-between items-center bg-purple-100">
        <div>{data.knowledgeBaseName || 'Knowledge Base Search'}</div>
        <button 
          onClick={handleTestClick}
          className="h-5 w-5 flex items-center justify-center rounded-full hover:bg-purple-200 transition-colors"
          title="Test this node"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-600">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        </button>
      </div>
      
      {/* Block content */}
      <div className="p-3">
        <div className="bg-white rounded-md p-3 flex items-center space-x-2 border border-purple-200">
          <Search className="h-5 w-5 text-purple-500" />
          <div className="text-sm text-purple-700">Knowledge Base Search</div>
        </div>
        
        {data.knowledgeBaseId && (
          <div className="mt-2 px-1 text-xs text-purple-700">
            <div className="font-medium">Knowledge Base:</div>
            <div className="truncate max-w-[250px] font-mono">{data.knowledgeBaseName || data.knowledgeBaseId}</div>
            {data.query && (
              <div className="mt-1">
                Query: <span className="font-mono">{data.query}</span>
              </div>
            )}
            {data.outputVariableName && (
              <div className="mt-1">
                Store in: <span className="font-mono">{data.outputVariableName}</span>
              </div>
            )}
          </div>
        )}
      </div>
      {/* Only one connection point on the left side - only accepts from AssistantNode */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-purple-500 hover:bg-purple-700 transition-colors kb-connection-target"
        id="kb-connection-target"
        isValidConnection={(connection) => {
          // Always allow connections from any source - we'll rely on visual feedback for guidance
          // but won't prevent valid connections from being made
          const sourceNode = document.querySelector(`[data-id="${connection.source}"]`);
          const isFromAssistantNode = sourceNode?.getAttribute('data-type') === 'assistantNode' || 
                                     sourceNode?.getAttribute('data-node-type') === 'assistantNode';
          
          // Only prevent self-connections
          const isValid = connection.target !== connection.source;
          
          // Show a visual feedback for valid connections from Assistant nodes
          if (isValid && isFromAssistantNode) {
            console.log('[KnowledgeBaseSearchNode] Valid connection from Assistant node');
            // If a connection is valid, update the visual appearance of the handle
            const handle = document.querySelector(`[data-id="${id}"] .kb-connection-target`) as HTMLElement;
            if (handle) {
              handle.classList.add('valid-connection-highlight');
              // Add a pulsing animation effect
              handle.style.animation = 'pulse-effect 1s';
              handle.style.border = '2px solid #8b5cf6';
              handle.style.boxShadow = '0 0 5px #8b5cf6';
              setTimeout(() => {
                handle.classList.remove('valid-connection-highlight');
                handle.style.animation = '';
                handle.style.border = '';
                handle.style.boxShadow = '';
              }, 1000);
            }
          }
          
          return isValid;
        }}
        data-tooltip="Knowledge Base Connection"
        data-connection-type="kb-connection"
        data-connection-label="KB Search"
        style={{ cursor: 'pointer' }}
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
          tooltip.classList.add('kb-connection-tooltip');
          document.body.appendChild(tooltip);
        }}
        onMouseLeave={() => {
          // Remove tooltip when not hovering
          const tooltip = document.querySelector('.kb-connection-tooltip');
          if (tooltip) {
            document.body.removeChild(tooltip);
          }
        }}
      />
      </div>
      {renderConfigModal()}
    </>
  );
});

KnowledgeBaseSearchNode.displayName = 'KnowledgeBaseSearchNode';
