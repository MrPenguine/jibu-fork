"use client";

import React, { useState, useEffect } from 'react';
import { AgentNodeType, FlowNode } from '../../../../src';
// AgentNodeType.KNOWLEDGE_BASE_SEARCH is now properly defined in types.ts
import { KnowledgeBaseSearchNodeData } from './nodes/KnowledgeBaseSearchNode';
import { KnowledgeBaseConfig } from '../assistants/KnowledgeBaseConfig';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
// Removed unused AssistantNodeData import
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface AgentNodeInspectorProps {
  node: FlowNode;
  onUpdate: (nodeId: string, data: any) => void;
  assistantId?: string;
}

export const AgentNodeInspector: React.FC<AgentNodeInspectorProps> = ({
  node,
  onUpdate,
  assistantId,
}) => {
  const [localData, setLocalData] = useState<any>(node.data || {});
  const [activeTab, setActiveTab] = useState('general');
  // Removed local AssistantConfigModal state; assistant editing is handled elsewhere

  // Update local data when node changes
  useEffect(() => {
    let initialData = node.data || {};
    if (node.type === AgentNodeType.ASSISTANT) {
      // Cast to AssistantNodeData to properly type the model property
      const assistantData = initialData as any;
      
      // If model is not an object (e.g. undefined, or old string format), initialize it.
      if (typeof assistantData.model !== 'object' || assistantData.model === null) {
        initialData = {
          ...initialData,
          model: {
            provider: typeof assistantData.model === 'string' ? 'default' : (assistantData.model?.provider || 'openai'),
            model: typeof assistantData.model === 'string' ? assistantData.model : (assistantData.model?.model || 'gpt-4-turbo'),
            temperature: assistantData.model?.temperature === undefined ? 0.7 : assistantData.model.temperature,
            maxTokens: assistantData.model?.maxTokens === undefined ? 2048 : assistantData.model.maxTokens,
            preference: assistantData.model?.preference || 'balance',
          },
        };
        
        // If old modelName existed, remove it to avoid confusion after migrating to model object
        if (typeof (node.data as any)?.modelName === 'string') {
          delete (initialData as any).modelName;
        }
      }
    }
    setLocalData(initialData);
  }, [node]);

  // Handle model sub-property changes
  const handleModelChange = (modelKey: string, modelValue: any) => {
    setLocalData((prev: any) => ({
      ...prev,
      model: {
        ...(prev.model || {}), // Ensure model object exists
        [modelKey]: modelValue,
      },
    }));
  };

  // Handle input changes
  const handleChange = (key: string, value: any) => {
    setLocalData((prev: any) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Apply changes
  const applyChanges = () => {
    onUpdate(node.id, localData);
  };

  // Render different forms based on node type
  const renderNodeForm = () => {
    // Check if it's a KnowledgeBaseSearchNode or a ToolCallNode being used as a knowledge base search
    if ((node.type as string === 'knowledgeBaseSearchNode') ||
        (node.type === AgentNodeType.TOOL_CALL && (node.data as any)?.toolName === 'knowledgeBaseSearch')) {
      // We need to create a custom rendering for KB search nodes
      const data = node.data as KnowledgeBaseSearchNodeData;
      
      return (
        <div className="p-4 space-y-4">
          <div>
            <Label htmlFor="knowledgeBaseName">Knowledge Base</Label>
            <div className="mt-2">
              <KnowledgeBaseConfig
                knowledgeBaseId={data.knowledgeBaseId}
                onKnowledgeBaseChange={(knowledgeBaseId) => {
                  handleChange('knowledgeBaseId', knowledgeBaseId);
                }}
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="query">Query</Label>
            <Textarea
              id="query"
              value={data.query || ''}
              onChange={(e) => handleChange('query', e.target.value)}
              placeholder="Enter query or use input variable"
              rows={3}
              className="mt-1"
            />
          </div>
          
          <div>
            <Label htmlFor="outputVariableName">Output Variable Name</Label>
            <Input
              id="outputVariableName"
              value={data.outputVariableName || ''}
              onChange={(e) => handleChange('outputVariableName', e.target.value)}
              placeholder="Variable name for results"
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">
              This variable will contain the search results
            </p>
          </div>
        </div>
      );
    }
    
    // Regular node types
    switch (node.type) {
      case AgentNodeType.START:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="label">Label</Label>
              <Input
                id="label"
                value={localData.label || 'Start'}
                onChange={(e) => handleChange('label', e.target.value)}
              />
            </div>
          </div>
        );

      case AgentNodeType.END:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="label">Label</Label>
              <Input
                id="label"
                value={localData.label || 'End'}
                onChange={(e) => handleChange('label', e.target.value)}
              />
            </div>
          </div>
        );

      case AgentNodeType.MESSAGE:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="label">Label</Label>
              <Input
                id="label"
                value={localData.label || 'Message'}
                onChange={(e) => handleChange('label', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={localData.message || ''}
                onChange={(e) => handleChange('message', e.target.value)}
                placeholder="Enter message text (supports {{variables.name}} syntax)"
                className="min-h-24"
              />
            </div>
            <div>
              <Label htmlFor="ttsProvider">TTS Provider (optional)</Label>
              <Select
                value={localData.ttsProvider || ''}
                onValueChange={(value) => handleChange('ttsProvider', value === 'none' ? '' : value)}
              >
                <SelectTrigger id="ttsProvider">
                  <SelectValue placeholder="Select TTS provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="azure">Azure</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {localData.ttsProvider && (
              <div>
                <Label htmlFor="voiceId">Voice ID (optional)</Label>
                <Input
                  id="voiceId"
                  value={localData.voiceId || ''}
                  onChange={(e) => handleChange('voiceId', e.target.value)}
                  placeholder="Enter voice ID"
                />
              </div>
            )}
          </div>
        );

      case AgentNodeType.LISTEN:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="label">Label</Label>
              <Input
                id="label"
                value={localData.label || 'Listen'}
                onChange={(e) => handleChange('label', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="variableName">Variable Name</Label>
              <Input
                id="variableName"
                value={localData.variableName || 'userInput'}
                onChange={(e) => handleChange('variableName', e.target.value)}
                placeholder="Where to store user input"
              />
            </div>
            <div>
              <Label htmlFor="inputType">Input Type</Label>
              <Select
                value={localData.inputType || 'text'}
                onValueChange={(value) => handleChange('inputType', value)}
              >
                <SelectTrigger id="inputType">
                  <SelectValue placeholder="Select input type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="button_id">Button ID</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="endOfSpeechTimeoutMs">End of Speech Timeout (ms)</Label>
              <Input
                id="endOfSpeechTimeoutMs"
                type="number"
                value={localData.endOfSpeechTimeoutMs || 1000}
                onChange={(e) => handleChange('endOfSpeechTimeoutMs', parseInt(e.target.value))}
              />
            </div>
          </div>
        );

      case AgentNodeType.CHOICE:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="label">Label</Label>
              <Input
                id="label"
                value={localData.label || 'Choice'}
                onChange={(e) => handleChange('label', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="message">Message (optional)</Label>
              <Textarea
                id="message"
                value={localData.message || ''}
                onChange={(e) => handleChange('message', e.target.value)}
                placeholder="Message to display before choices"
              />
            </div>
            <div>
              <Label htmlFor="variableName">Variable Name (optional)</Label>
              <Input
                id="variableName"
                value={localData.variableName || ''}
                onChange={(e) => handleChange('variableName', e.target.value)}
                placeholder="Where to store chosen value"
              />
            </div>
            <div>
              <Label>Choices</Label>
              <div className="space-y-2 mt-2">
                {(localData.choices || []).map((choice: any, index: number) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={choice.label || ''}
                      onChange={(e) => {
                        const newChoices = [...(localData.choices || [])];
                        newChoices[index] = { ...newChoices[index], label: e.target.value };
                        handleChange('choices', newChoices);
                      }}
                      placeholder="Label"
                      className="flex-1"
                    />
                    <Input
                      value={choice.value || ''}
                      onChange={(e) => {
                        const newChoices = [...(localData.choices || [])];
                        newChoices[index] = { ...newChoices[index], value: e.target.value };
                        handleChange('choices', newChoices);
                      }}
                      placeholder="Value"
                      className="flex-1"
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        const newChoices = [...(localData.choices || [])];
                        newChoices.splice(index, 1);
                        handleChange('choices', newChoices);
                      }}
                    >
                      X
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newChoices = [...(localData.choices || []), { label: '', value: '' }];
                    handleChange('choices', newChoices);
                  }}
                >
                  Add Choice
                </Button>
              </div>
            </div>
          </div>
        );

      case AgentNodeType.CONDITION:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="label">Label</Label>
              <Input
                id="label"
                value={localData.label || 'Condition'}
                onChange={(e) => handleChange('label', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="variable">Variable</Label>
              <Input
                id="variable"
                value={localData.variable || ''}
                onChange={(e) => handleChange('variable', e.target.value)}
                placeholder="e.g., variables.userInput"
              />
            </div>
            <div>
              <Label htmlFor="operator">Operator</Label>
              <Select
                value={localData.operator || 'equals'}
                onValueChange={(value) => handleChange('operator', value)}
              >
                <SelectTrigger id="operator">
                  <SelectValue placeholder="Select operator" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equals">Equals</SelectItem>
                  <SelectItem value="contains">Contains</SelectItem>
                  <SelectItem value="startsWith">Starts With</SelectItem>
                  <SelectItem value="isSet">Is Set</SelectItem>
                  <SelectItem value="isNotSet">Is Not Set</SelectItem>
                  <SelectItem value="greaterThan">Greater Than</SelectItem>
                  <SelectItem value="lessThan">Less Than</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {localData.operator !== 'isSet' && localData.operator !== 'isNotSet' && (
              <div>
                <Label htmlFor="value">Value</Label>
                <Input
                  id="value"
                  value={localData.value || ''}
                  onChange={(e) => handleChange('value', e.target.value)}
                  placeholder="Value to compare against"
                />
              </div>
            )}
            <div>
              <Label htmlFor="trueTargetNodeId">True Target Node ID (optional)</Label>
              <Input
                id="trueTargetNodeId"
                value={localData.trueTargetNodeId || ''}
                onChange={(e) => handleChange('trueTargetNodeId', e.target.value)}
                placeholder="Node ID to go to if true"
              />
            </div>
            <div>
              <Label htmlFor="falseTargetNodeId">False Target Node ID (optional)</Label>
              <Input
                id="falseTargetNodeId"
                value={localData.falseTargetNodeId || ''}
                onChange={(e) => handleChange('falseTargetNodeId', e.target.value)}
                placeholder="Node ID to go to if false"
              />
            </div>
          </div>
        );

      case AgentNodeType.SET_VARIABLE:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="label">Label</Label>
              <Input
                id="label"
                value={localData.label || 'Set Variable'}
                onChange={(e) => handleChange('label', e.target.value)}
              />
            </div>
            <div>
              <Label>Variable Assignments</Label>
              <div className="space-y-2 mt-2">
                {(localData.assignments || []).map((assignment: any, index: number) => (
                  <div key={index} className="space-y-2 border p-2 rounded">
                    <div className="flex gap-2">
                      <Input
                        value={assignment.variableName || ''}
                        onChange={(e) => {
                          const newAssignments = [...(localData.assignments || [])];
                          newAssignments[index] = { ...newAssignments[index], variableName: e.target.value };
                          handleChange('assignments', newAssignments);
                        }}
                        placeholder="Variable Name"
                        className="flex-1"
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          const newAssignments = [...(localData.assignments || [])];
                          newAssignments.splice(index, 1);
                          handleChange('assignments', newAssignments);
                        }}
                      >
                        X
                      </Button>
                    </div>
                    <Textarea
                      value={typeof assignment.value === 'object' ? JSON.stringify(assignment.value) : assignment.value || ''}
                      onChange={(e) => {
                        const newAssignments = [...(localData.assignments || [])];
                        try {
                          // Try to parse as JSON if it looks like an object
                          const value = e.target.value.trim().startsWith('{') ? JSON.parse(e.target.value) : e.target.value;
                          newAssignments[index] = { ...newAssignments[index], value };
                        } catch {
                          // If not valid JSON, store as string
                          newAssignments[index] = { ...newAssignments[index], value: e.target.value };
                        }
                        handleChange('assignments', newAssignments);
                      }}
                      placeholder="Value"
                      className="min-h-16"
                    />
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id={`evaluate-${index}`}
                        checked={assignment.evaluate || false}
                        onChange={(e) => {
                          const newAssignments = [...(localData.assignments || [])];
                          newAssignments[index] = { ...newAssignments[index], evaluate: e.target.checked };
                          handleChange('assignments', newAssignments);
                        }}
                        className="mr-2"
                      />
                      <Label htmlFor={`evaluate-${index}`}>Evaluate as expression</Label>
                    </div>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newAssignments = [...(localData.assignments || []), { variableName: '', value: '', evaluate: false }];
                    handleChange('assignments', newAssignments);
                  }}
                >
                  Add Assignment
                </Button>
              </div>
            </div>
          </div>
        );

      case AgentNodeType.API_CALL:
        return (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="headers">Headers</TabsTrigger>
              <TabsTrigger value="body">Body</TabsTrigger>
            </TabsList>
            <TabsContent value="general" className="space-y-4">
              <div>
                <Label htmlFor="label">Label</Label>
                <Input
                  id="label"
                  value={localData.label || 'API Call'}
                  onChange={(e) => handleChange('label', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="url">URL</Label>
                <Input
                  id="url"
                  value={localData.url || ''}
                  onChange={(e) => handleChange('url', e.target.value)}
                  placeholder="https://example.com/api"
                />
              </div>
              <div>
                <Label htmlFor="method">Method</Label>
                <Select
                  value={localData.method || 'GET'}
                  onValueChange={(value) => handleChange('method', value)}
                >
                  <SelectTrigger id="method">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                    <SelectItem value="DELETE">DELETE</SelectItem>
                    <SelectItem value="PATCH">PATCH</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="responseVariableName">Response Variable Name</Label>
                <Input
                  id="responseVariableName"
                  value={localData.responseVariableName || 'apiResponse'}
                  onChange={(e) => handleChange('responseVariableName', e.target.value)}
                  placeholder="Where to store the response"
                />
              </div>
              <div>
                <Label htmlFor="timeoutMs">Timeout (ms)</Label>
                <Input
                  id="timeoutMs"
                  type="number"
                  value={localData.timeoutMs || 30000}
                  onChange={(e) => handleChange('timeoutMs', parseInt(e.target.value))}
                />
              </div>
            </TabsContent>
            <TabsContent value="headers" className="space-y-4">
              <div>
                <Label>Headers</Label>
                <div className="space-y-2 mt-2">
                  {Object.entries(localData.headers || {}).map(([key, value]: [string, any], index: number) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={key}
                        onChange={(e) => {
                          const newHeaders = { ...localData.headers };
                          const oldValue = newHeaders[key];
                          delete newHeaders[key];
                          newHeaders[e.target.value] = oldValue;
                          handleChange('headers', newHeaders);
                        }}
                        placeholder="Header Name"
                        className="flex-1"
                      />
                      <Input
                        value={value}
                        onChange={(e) => {
                          const newHeaders = { ...localData.headers };
                          newHeaders[key] = e.target.value;
                          handleChange('headers', newHeaders);
                        }}
                        placeholder="Value"
                        className="flex-1"
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          const newHeaders = { ...localData.headers };
                          delete newHeaders[key];
                          handleChange('headers', newHeaders);
                        }}
                      >
                        X
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newHeaders = { ...localData.headers, '': '' };
                      handleChange('headers', newHeaders);
                    }}
                  >
                    Add Header
                  </Button>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="body" className="space-y-4">
              <div>
                <Label htmlFor="body">Request Body (JSON)</Label>
                <Textarea
                  id="body"
                  value={localData.body || ''}
                  onChange={(e) => handleChange('body', e.target.value)}
                  placeholder='{"key": "value"}'
                  className="min-h-64 font-mono"
                />
              </div>
            </TabsContent>
          </Tabs>
        );

      case AgentNodeType.TOOL_CALL:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="label">Label</Label>
              <Input
                id="label"
                value={localData.label || 'Tool Call'}
                onChange={(e) => handleChange('label', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="toolId">Tool ID</Label>
              <Input
                id="toolId"
                value={localData.toolId || ''}
                onChange={(e) => handleChange('toolId', e.target.value)}
                placeholder="ID of the tool to execute"
              />
            </div>
            <div>
              <Label htmlFor="outputVariableName">Output Variable Name</Label>
              <Input
                id="outputVariableName"
                value={localData.outputVariableName || 'toolOutput'}
                onChange={(e) => handleChange('outputVariableName', e.target.value)}
                placeholder="Where to store the tool output"
              />
            </div>
            <div>
              <Label>Input Mapping</Label>
              <div className="space-y-2 mt-2">
                {Object.entries(localData.inputMapping || {}).map(([key, value]: [string, any], index: number) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={key}
                      onChange={(e) => {
                        const newMapping = { ...localData.inputMapping };
                        const oldValue = newMapping[key];
                        delete newMapping[key];
                        newMapping[e.target.value] = oldValue;
                        handleChange('inputMapping', newMapping);
                      }}
                      placeholder="Tool Parameter"
                      className="flex-1"
                    />
                    <Input
                      value={value}
                      onChange={(e) => {
                        const newMapping = { ...localData.inputMapping };
                        newMapping[key] = e.target.value;
                        handleChange('inputMapping', newMapping);
                      }}
                      placeholder="Agent Variable"
                      className="flex-1"
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        const newMapping = { ...localData.inputMapping };
                        delete newMapping[key];
                        handleChange('inputMapping', newMapping);
                      }}
                    >
                      X
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newMapping = { ...localData.inputMapping, '': '' };
                    handleChange('inputMapping', newMapping);
                  }}
                >
                  Add Mapping
                </Button>
              </div>
            </div>
          </div>
        );


      // Special case for KB Search nodes - they're not in the enum but use a string constant
      case 'knowledgeBaseSearchNode':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="label">Label</Label>
              <Input
                id="label"
                value={localData.label || 'KB Search'}
                onChange={(e) => handleChange('label', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="knowledgeBaseId">Knowledge Base ID</Label>
              <Input
                id="knowledgeBaseId"
                value={localData.knowledgeBaseId || ''}
                onChange={(e) => handleChange('knowledgeBaseId', e.target.value)}
                placeholder="ID of the knowledge base to search"
              />
            </div>
            <div>
              <Label htmlFor="query">Query</Label>
              <Textarea
                id="query"
                value={localData.query || ''}
                onChange={(e) => handleChange('query', e.target.value)}
                placeholder="Enter query or use input variable"
                className="min-h-20"
              />
            </div>
            <div>
              <Label htmlFor="outputVariableName">Output Variable Name</Label>
              <Input
                id="outputVariableName"
                value={localData.outputVariableName || 'kbSearchResult'}
                onChange={(e) => handleChange('outputVariableName', e.target.value)}
                placeholder="Where to store search results"
              />
            </div>
          </div>
        );
        
      case AgentNodeType.ASSISTANT:
        // For assistant nodes, only show basic information; configuration is edited via the main modal elsewhere
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={localData.name || ''}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Assistant name"
              />
            </div>
            <div>
              <Label htmlFor="apiAssistantId">API Assistant ID</Label>
              <Input
                id="apiAssistantId"
                value={localData.apiAssistantId || ''}
                onChange={(e) => handleChange('apiAssistantId', e.target.value)}
                placeholder="OpenAI Assistant ID"
                disabled={!!assistantId}
              />
            </div>
            <div className="p-4 bg-blue-50 rounded-md text-blue-800">
              <p>Double-click the assistant node in the canvas to edit its configuration.</p>
            </div>
          </div>
        );

      default:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="label">Label</Label>
              <Input
                id="label"
                value={localData.label || node.type}
                onChange={(e) => handleChange('label', e.target.value)}
              />
            </div>
          </div>
        );
    }
  };

  // Helper function to get a display friendly node type name
  const getNodeTypeDisplay = (nodeType: string) => {
    if (nodeType === 'knowledgeBaseSearchNode') {
      return 'Knowledge Base Search';
    }
    return nodeType;
  };
  
  return (
    <Card className="w-full">
      <CardHeader className="py-3">
        <CardTitle className="text-sm font-medium">Node Properties: {getNodeTypeDisplay(node.type)}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {renderNodeForm()}
        <Button onClick={applyChanges} className="w-full">
          Apply Changes
        </Button>
      </CardContent>
    </Card>
  );
};
