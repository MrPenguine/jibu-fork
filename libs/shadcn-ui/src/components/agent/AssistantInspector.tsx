"use client";

import React, { useState, useEffect } from 'react';
import { Bot, ChevronDown, Pencil } from 'lucide-react';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { AssistantNodeData } from './nodes/AssistantNode';
import { FlowNode } from '../../../src/types';

interface AssistantInspectorProps {
  node: FlowNode;
  onUpdate: (nodeId: string, data: Partial<AssistantNodeData>) => void;
  onOpenAssistantConfig?: (nodeId: string, event?: React.MouseEvent) => void;
}

export const AssistantInspector: React.FC<AssistantInspectorProps> = ({
  node,
  onUpdate,
  onOpenAssistantConfig,
}) => {
  const [localData, setLocalData] = useState<AssistantNodeData>((node.data as AssistantNodeData) || {});
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // Update local data when node changes
  useEffect(() => {
    setLocalData((node.data as AssistantNodeData) || {});
  }, [node]);

  // Handle input changes
  const handleChange = (key: string, value: any) => {
    setLocalData((prev) => ({
      ...prev,
      [key]: value,
    }));
    
    // Update the node data
    onUpdate(node.id, {
      ...localData,
      [key]: value,
    });
  };

  // Mock assistants data - in a real implementation, this would come from an API
  const availableAssistants = [
    { id: '1', name: 'Lead qualification specialist' },
    { id: '2', name: 'Customer support agent' },
    { id: '3', name: 'Sales representative' },
  ];

  return (
    <div className="p-4 space-y-4 h-full overflow-y-auto bg-white">
      <div className="flex items-center justify-between border-b pb-2 mb-2">
        <h2 className="text-xl font-bold text-slate-800">Assistant</h2>
      </div>
      
      {/* Assistant selection dropdown */}
      <div className="relative">
        <div 
          className="flex items-center justify-between border rounded-md p-2 cursor-pointer"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        >
          <div className="flex items-center gap-2">
            <Pencil className="h-4 w-4" />
            <span>{localData.name || 'Select an assistant'}</span>
          </div>
          <ChevronDown className="h-4 w-4" />
        </div>
        
        {isDropdownOpen && (
          <div className="absolute w-full mt-1 bg-white border rounded-md shadow-lg z-10">
            {availableAssistants.map((assistant) => (
              <div 
                key={assistant.id}
                className="p-2 hover:bg-gray-100 cursor-pointer"
                onClick={() => {
                  handleChange('apiAssistantId', assistant.id);
                  handleChange('name', assistant.name);
                  setIsDropdownOpen(false);
                }}
              >
                {assistant.name}
              </div>
            ))}
            <div className="p-2 hover:bg-gray-100 cursor-pointer border-t">
              Create assistant
            </div>
          </div>
        )}
      </div>
      
      {/* Edit agent button */}
      <Button 
        className="w-full bg-blue-500 hover:bg-blue-600"
        onClick={(e) => {
          if (onOpenAssistantConfig) onOpenAssistantConfig(node.id, e as any);
        }}
      >
        Edit agent
      </Button>
      
      {/* Settings */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="listenForIntents">Listen for other intents</Label>
          <Switch 
            id="listenForIntents" 
            checked={localData.listenForIntents || false}
            onCheckedChange={(checked) => handleChange('listenForIntents', checked)}
          />
        </div>
        
        <div className="flex items-center justify-between">
          <Label htmlFor="exitConversation">Exit every conversational turn</Label>
          <Switch 
            id="exitConversation" 
            checked={localData.exitConversation || false}
            onCheckedChange={(checked) => handleChange('exitConversation', checked)}
          />
        </div>
      </div>
      
      {/* The placeholder modal has been removed in favor of the unified AssistantConfigModal managed by the canvas page. */}
    </div>
  );
};

export default AssistantInspector;
