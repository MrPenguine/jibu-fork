"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '../ui/dialog';
import { Sheet, SheetContent } from '../ui/sheet';
import { AssistantNodeData } from './nodes/AssistantNode';
import { ModelConfig } from '../assistants/ModelConfig';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { Input } from '../ui/input';
import { Plus } from 'lucide-react';
import PromptSettingsPanel from './nodes/PromptSettingsPanel';

export interface AssistantConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assistantData: AssistantNodeData | null;
  onSave: (updatedData: AssistantNodeData) => void;
}

export const AssistantConfigModal: React.FC<AssistantConfigModalProps> = ({
  open,
  onOpenChange,
  assistantData,
  onSave,
}) => {
  const [isPromptSettingsPanelOpen, setIsPromptSettingsPanelOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  // Keep local copy so typing doesn't trigger parent save/close
  const [localData, setLocalData] = useState<AssistantNodeData | null>(assistantData);
  // Log when the modal receives new data
  React.useEffect(() => {
    if (assistantData) {
      console.log(`[AssistantConfigModal] Received assistant data:`, JSON.stringify(assistantData, null, 2));
    }
  }, [assistantData]);
  
  // Warn (without breaking Hooks ordering) when modal is open but there's no data
  useEffect(() => {
    if (open && !assistantData) {
      console.warn(`[AssistantConfigModal] Modal open but no assistantData`);
    }
  }, [open, assistantData]);

  // Sync local state when incoming data changes
  useEffect(() => {
    setLocalData(assistantData || null);
  }, [assistantData]);

  // Handle model configuration changes (local only)
  const handleModelConfigChange = (field: string, value: any) => {
    setLocalData((prev) => {
      const base = (prev || assistantData || {}) as AssistantNodeData;
      let updated: AssistantNodeData = { ...base } as AssistantNodeData;
      if (field === 'name') {
        updated = { ...updated, name: value };
      } else if (field === 'systemMessage') {
        updated = { ...updated, systemMessage: value };
      } else if (field === 'firstMessage') {
        updated = { ...updated, firstMessage: value };
      } else if (field === 'knowledgeBaseId') {
        updated = { ...updated, knowledgeBaseId: value };
      } else if (field === 'model') {
        updated = {
          ...updated,
          model: {
            ...(updated.model || {} as any),
            ...value,
          },
        } as AssistantNodeData;
      }
      return updated;
    });
  };

  // Compute a user-friendly label for the selected model, matching PromptSettingsPanel labels
  const getModelLabel = (): string => {
    const provider = localData?.model?.provider ?? assistantData?.model?.provider;
    const id = localData?.model?.model ?? assistantData?.model?.model;
    if (!provider || !id) return 'Model';
    const map: Record<string, Record<string, string>> = {
      openai: {
        'gpt-3.5-turbo': 'openai-gpt-3.5 turbo',
        'gpt-4-turbo': 'openai-gpt-4 turbo',
        'gpt-4': 'openai-gpt-4',
        'gpt-4o': 'openai-gpt-4o',
        'gpt-4o-mini': 'openai-gpt-4o mini',
        'o1': 'openai-o1',
        'o1-mini': 'openai-o1 mini',
      },
      anthropic: {
        'claude-3.5-sonnet': 'anthropic-claude-3.5-sonnet',
        'claude-3.5-haiku': 'anthropic-claude-3.5-haiku',
        'claude-3-opus': 'anthropic-claude-3-opus',
        'claude-3.7-sonnet': 'anthropic-claude-3.7-sonnet',
        'claude-4-sonnet': 'anthropic-claude-4-sonnet',
        'claude-4-opus': 'anthropic-claude-4-opus',
      },
      google: {
        'gemini-2.0-flash': 'google-gemini-2.0-flash',
        'gemini-2.5-pro': 'google-gemini-2.5-pro',
        'gemini-2.5-flash': 'google-gemini-2.5-flash',
      },
      xai: {
        'grok-3': 'xai-grok-3',
        'grok-3-mini': 'xai-grok-3 mini',
        'grok-2': 'xai-grok-2',
      },
      deepseek: {
        'r1-distill-llama-70b': 'deepseek-r1 distill llama 70b',
      },
      meta: {
        'llama-3.1-instant': 'meta-llama 3.1 instant',
      },
    };
    return map[provider]?.[id] ?? `${provider}-${id.replace(/-/g, ' ')}`;
  };
  
  // Handle model selection from the panel
  const handleModelSelect = (selectedModel: { provider: string; model: string }) => {
    handleModelConfigChange('model', selectedModel);
  };
  
  // Focus the name input when editing starts
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [isEditingName]);
  
  // Handle name edit completion
  const handleNameEditComplete = () => {
    setIsEditingName(false);
  };

  // Render a small provider badge for the selected model
  const ProviderBadge: React.FC<{ provider?: string }> = ({ provider }) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      openai: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'O' },
      anthropic: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'A' },
      google: { bg: 'bg-green-100', text: 'text-green-800', label: 'G' },
      xai: { bg: 'bg-slate-100', text: 'text-slate-800', label: 'X' },
      deepseek: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'D' },
      meta: { bg: 'bg-indigo-100', text: 'text-indigo-800', label: 'M' },
    };
    const s = provider ? map[provider] : undefined;
    const bg = s?.bg ?? 'bg-slate-100';
    const txt = s?.text ?? 'text-slate-800';
    const ch = s?.label ?? '?';
    return (
      <span
        className={`inline-flex items-center justify-center w-5 h-5 rounded ${bg} ${txt} text-xs font-semibold`}
        aria-hidden="true"
      >
        {ch}
      </span>
    );
  };

  // Only Instructions are shown now; removed tabs and extra sections.

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[1280px] h-[85vh] p-0 overflow-hidden border border-gray-200 rounded-xl">
        <DialogHeader className="p-4 border-b w-full flex items-center justify-between">
          {isEditingName && (
            // Visually hidden title to ensure a DialogTitle is always present for a11y
            <DialogTitle className="sr-only">
              {assistantData?.name || 'Assistant Configuration'}
            </DialogTitle>
          )}
          {isEditingName ? (
            <Input
              ref={nameInputRef}
              defaultValue={localData?.name || assistantData?.name || 'Sales helper'}
              className="max-w-[300px] text-lg font-semibold"
              onBlur={(e) => {
                handleModelConfigChange('name', e.target.value);
                handleNameEditComplete();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleModelConfigChange('name', e.currentTarget.value);
                  handleNameEditComplete();
                }
              }}
            />
          ) : (
            <DialogTitle 
              className="cursor-pointer hover:text-blue-600 transition-colors"
              onDoubleClick={() => setIsEditingName(true)}
            >
              {localData?.name || assistantData?.name || 'Sales helper'}
            </DialogTitle>
          )}
          <div className="flex items-center gap-2 ml-auto">
            {/* Save stays on the right group but before the Model button */}
            <Button
              size="sm"
              className="bg-blue-600 text-white hover:bg-blue-700"
              onClick={() => {
                if (localData) {
                  onSave(localData);
                }
              }}
            >
              Save
            </Button>
            {/* Model button next to the close (X) - light primary pill */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsPromptSettingsPanelOpen(!isPromptSettingsPanelOpen)}
              className="inline-flex items-center gap-2 h-8 px-3 rounded-full bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
              aria-label="Model settings"
              title="Model settings"
            >
              <ProviderBadge provider={localData?.model?.provider ?? assistantData?.model?.provider} />
              <span className="ml-2 text-sm">{getModelLabel()}</span>
            </Button>
            <DialogClose />
          </div>
        </DialogHeader>
        
        <div className={`grid grid-cols-[1fr_320px] h-[calc(100%-4rem)]`}>
          {/* Left side - Main content: only Instructions */}
          <div className="p-6 overflow-y-auto border-r">
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">Instructions</h3>
                <Textarea 
                  className="min-h-[500px] font-normal text-sm bg-slate-50 w-full" 
                  value={(localData?.systemMessage ?? assistantData?.systemMessage) || `### Role
The chat agent assists users by providing information and support related to sales. It is responsible for answering questions, offering product recommendations, and guiding users through the sales process to enhance their purchasing experience.

### Personality
The agent should be friendly, approachable, and professional, ensuring users feel comfortable and valued. It should convey enthusiasm about helping customers and demonstrate a strong understanding of sales strategies. The tone should be encouraging and supportive, fostering a positive interaction.

### Goals
The primary goal is to effectively address user inquiries and concerns regarding sales, leading to increased customer satisfaction and conversion rates. The agent should aim to build rapport with users by actively listening and responding to their needs. Ultimately, the agent seeks to facilitate smooth transactions and promote repeat business through exceptional service.`}
                  onChange={(e) => handleModelConfigChange('systemMessage', e.target.value)}
                />
              </div>
            </div>
          </div>
          
          {/* Right side - Sidebar */}
          <div className="p-4 bg-gray-50 overflow-y-auto">
            <div className="space-y-6">
              <div>
                <h3 className="font-medium mb-2">Tools</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1 p-2 border rounded-md">
                    <div className="w-5 h-5 flex items-center justify-center bg-blue-100 rounded text-blue-800 text-xs">Z</div>
                    <span className="text-xs">Zendesk</span>
                  </div>
                  <div className="flex items-center gap-1 p-2 border rounded-md">
                    <div className="w-5 h-5 flex items-center justify-center bg-green-100 rounded text-green-800 text-xs">G</div>
                    <span className="text-xs">Google Sheets</span>
                  </div>
                  <div className="flex items-center gap-1 p-2 border rounded-md">
                    <div className="w-5 h-5 flex items-center justify-center bg-blue-100 rounded text-blue-800 text-xs">S</div>
                    <span className="text-xs">Salesforce</span>
                  </div>
                  <div className="flex items-center gap-1 p-2 border rounded-md">
                    <div className="w-5 h-5 flex items-center justify-center bg-red-100 rounded text-red-800 text-xs">G</div>
                    <span className="text-xs">Gmail</span>
                  </div>
                  <div className="flex items-center gap-1 p-2 border rounded-md">
                    <div className="w-5 h-5 flex items-center justify-center bg-purple-100 rounded text-purple-800 text-xs">A</div>
                    <span className="text-xs">Airtable</span>
                  </div>
                  <div className="flex items-center gap-1 p-2 border rounded-md">
                    <div className="w-5 h-5 flex items-center justify-center bg-indigo-100 rounded text-indigo-800 text-xs">M</div>
                    <span className="text-xs">Make</span>
                  </div>
                  <div className="flex items-center gap-1 p-2 border rounded-md">
                    <div className="w-5 h-5 flex items-center justify-center bg-cyan-100 rounded text-cyan-800 text-xs">T</div>
                    <span className="text-xs">Twilio</span>
                  </div>
                  <div className="flex items-center gap-1 p-2 border rounded-md">
                    <div className="w-5 h-5 flex items-center justify-center bg-orange-100 rounded text-orange-800 text-xs">H</div>
                    <span className="text-xs">Hubspot</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="font-medium mb-2">Knowledge base</h3>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Enabled</span>
                  <Switch id="kb-sidebar" />
                </div>
              </div>
              
              <div>
                <h3 className="font-medium mb-2">Buttons</h3>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Enabled</span>
                  <Switch id="buttons-enabled" />
                </div>
              </div>
              
              <div>
                <h3 className="font-medium mb-2">Cards</h3>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Enabled</span>
                  <Switch id="cards-enabled" />
                </div>
              </div>
              
              <div>
                <h3 className="font-medium mb-2">Carousels</h3>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Enabled</span>
                  <Switch id="carousels-enabled" />
                </div>
              </div>
              
              <div>
                <h3 className="font-medium mb-2">Exit conditions</h3>
                <div className="flex items-center justify-between">
                  <span className="text-sm">New exit condition (inactive)</span>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
      {/* Slide-over prompt settings on top of the modal */}
      <Sheet open={isPromptSettingsPanelOpen} onOpenChange={setIsPromptSettingsPanelOpen}>
        <SheetContent side="right" className="h-full sm:max-w-md w-[420px] p-0 z-[60]">
          <PromptSettingsPanel
            currentModel={localData?.model ?? assistantData?.model}
            onModelSelect={handleModelSelect}
            onClose={() => setIsPromptSettingsPanelOpen(false)}
            className="h-full"
          />
        </SheetContent>
      </Sheet>
    </Dialog>
  );
};
