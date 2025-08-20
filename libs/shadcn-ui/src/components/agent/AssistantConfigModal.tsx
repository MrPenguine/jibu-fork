"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '../ui/dialog';
import { AssistantNodeData } from './nodes/AssistantNode';
import { ModelConfig } from '../assistants/ModelConfig';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { ChevronDown, ChevronUp, Plus } from 'lucide-react';

export interface AssistantConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  assistantData: AssistantNodeData | null;
  onSave: (updatedData: AssistantNodeData) => void;
}

export const AssistantConfigModal: React.FC<AssistantConfigModalProps> = ({
  isOpen,
  onClose,
  assistantData,
  onSave,
}) => {
  // Log when the modal receives new data
  React.useEffect(() => {
    if (assistantData) {
      console.log(`[AssistantConfigModal] Received assistant data:`, JSON.stringify(assistantData, null, 2));
    }
  }, [assistantData]);
  
  if (!isOpen || !assistantData) {
    console.warn(`[AssistantConfigModal] Modal not shown: isOpen=${isOpen}, assistantData=${!!assistantData}`);
    return null;
  }

  // Handle model configuration changes
  const handleModelConfigChange = (field: string, value: any) => {
    if (!assistantData) return;

    console.log(`[AssistantConfigModal] Handling field change: ${field} =`, value);
    
    // Create updated assistant data based on what field was changed
    let updatedData;
    
    if (field === 'systemMessage') {
      updatedData = { ...assistantData, systemMessage: value };
    } else if (field === 'firstMessage') {
      updatedData = { ...assistantData, firstMessage: value };
    } else if (field === 'knowledgeBaseId') {
      updatedData = { ...assistantData, knowledgeBaseId: value };
    } else if (field === 'model') {
      // For model changes, update the nested model object while preserving other properties
      updatedData = {
        ...assistantData,
        model: {
          ...(assistantData.model || {}),
          ...value
        }
      };
    }

    // Save changes if updatedData was created
    if (updatedData) {
      console.log(`[AssistantConfigModal] Saving updated data:`, JSON.stringify(updatedData, null, 2));
      onSave(updatedData);
    }
  };

  const [activeTab, setActiveTab] = useState('instructions');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'identity': true,
    'voice': true,
    'personality': true,
    'conversation': true
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full max-w-[900px] h-[80vh] p-0 overflow-hidden border border-gray-200 rounded-xl">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>Lead qualification specialist</DialogTitle>
          <DialogClose onClick={onClose} className="absolute right-4 top-4" />
        </DialogHeader>
        
        <div className="grid grid-cols-[1fr_300px] h-[calc(100%-4rem)]">
          {/* Left side - Main content */}
          <div className="p-6 overflow-y-auto border-r">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="instructions">Instructions</TabsTrigger>
                <TabsTrigger value="tasks">Tasks</TabsTrigger>
                <TabsTrigger value="knowledge">Knowledge base</TabsTrigger>
              </TabsList>
              
              <TabsContent value="instructions" className="space-y-6">
                {/* Lead Qualification & Nurturing Section */}
                <div className="space-y-2">
                  <div className="text-blue-600 font-medium"># Lead Qualification & Nurturing Agent Prompt</div>
                </div>
                
                {/* Identity & Purpose Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection('identity')}>
                    <div className="text-blue-600 font-medium">## Identity & Purpose</div>
                    {expandedSections['identity'] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                  
                  {expandedSections['identity'] && (
                    <Textarea 
                      className="min-h-[100px] font-normal text-sm" 
                      value="You are Avery, a business development voice assistant for AcmeFuture, a B2B software solutions provider. Your primary purpose is to identify qualified leads, understand their business challenges, and connect them with the appropriate sales representatives for solutions that match their needs."
                      onChange={(e) => handleModelConfigChange('systemMessage', e.target.value)}
                    />
                  )}
                </div>
                
                {/* Voice & Presence Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection('voice')}>
                    <div className="text-blue-600 font-medium">## Voice & Presence</div>
                    {expandedSections['voice'] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                  
                  {expandedSections['voice'] && (
                    <Textarea 
                      className="min-h-[100px] font-normal text-sm" 
                      value="- Warm, consultative, and genuinely interested in the prospect's business\n- Convey confidence and expertise without being pushy or aggressive\n- Maintain a helpful, solution-oriented approach rather than a traditional 'sales' persona\n- Balance professionalism with approachable warmth"
                    />
                  )}
                </div>
                
                {/* Personality Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection('personality')}>
                    <div className="text-blue-600 font-medium">## Personality</div>
                    {expandedSections['personality'] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>
                
                {/* Conversation Flow Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection('conversation')}>
                    <div className="text-blue-600 font-medium">## Conversation Flow</div>
                    {expandedSections['conversation'] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="tasks" className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <h3 className="font-medium">Integrations</h3>
                    <Button variant="ghost" size="sm" className="h-8 px-2">
                      <Plus className="h-4 w-4 mr-1" /> Add
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <div className="border rounded-md p-2 flex items-center justify-center text-center text-sm">
                      <span>Zendesk</span>
                    </div>
                    <div className="border rounded-md p-2 flex items-center justify-center text-center text-sm">
                      <span>Google Sheets</span>
                    </div>
                    <div className="border rounded-md p-2 flex items-center justify-center text-center text-sm">
                      <span>Salesforce</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <h3 className="font-medium">Actions</h3>
                    <Button variant="ghost" size="sm" className="h-8 px-2">
                      <Plus className="h-4 w-4 mr-1" /> Add
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <div className="border rounded-md p-2 flex items-center justify-center text-center text-sm">
                      <span>Email</span>
                    </div>
                    <div className="border rounded-md p-2 flex items-center justify-center text-center text-sm">
                      <span>Notes</span>
                    </div>
                    <div className="border rounded-md p-2 flex items-center justify-center text-center text-sm">
                      <span>Tasks</span>
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="knowledge" className="space-y-4">
                <div className="space-y-2">
                  <h3 className="font-medium">Knowledge base</h3>
                  <p className="text-sm text-gray-600">Connect a knowledge base to this assistant</p>
                  
                  <div className="flex items-center justify-between mt-4">
                    <Switch id="kb-enabled" />
                    <span className="text-sm">Enabled</span>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
          
          {/* Right side - Sidebar */}
          <div className="p-4 bg-gray-50 overflow-y-auto">
            <div className="space-y-6">
              <div>
                <h3 className="font-medium mb-2">Tasks</h3>
                <div className="space-y-1">
                  <div className="flex items-center text-sm">
                    <div className="w-4 h-4 rounded-sm border mr-2 flex-shrink-0"></div>
                    <span>Zendesk</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <div className="w-4 h-4 rounded-sm border mr-2 flex-shrink-0"></div>
                    <span>Google Sheets</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <div className="w-4 h-4 rounded-sm border mr-2 flex-shrink-0"></div>
                    <span>Salesforce</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="font-medium mb-2">Knowledge base</h3>
                <div className="flex items-center">
                  <Switch id="kb-sidebar" className="mr-2" />
                  <span className="text-sm">Enabled</span>
                </div>
              </div>
              
              <div>
                <h3 className="font-medium mb-2">Cards</h3>
                <div className="text-sm text-gray-500">0</div>
              </div>
              
              <div>
                <h3 className="font-medium mb-2">Commands</h3>
                <div className="text-sm text-gray-500">0</div>
              </div>
              
              <div>
                <h3 className="font-medium mb-2">Exit conditions</h3>
                <Button variant="outline" size="sm" className="w-full mt-1">
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
