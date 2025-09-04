"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '../ui/dialog';
import { AssistantNodeData } from './nodes/AssistantNode';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { Input } from '../ui/input';
import { Plus } from 'lucide-react';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { getAssistantById, updateAssistant } from '../../../../../apps/frontend/src/utils/assistants-min';

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
  const [isEditingName, setIsEditingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  // Keep local copy so typing doesn't trigger parent save/close
  const [localData, setLocalData] = useState<AssistantNodeData | null>(assistantData);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  // Track whether the user has made any edits in this session
  const isDirtyRef = useRef(false);
  const justOpenedRef = useRef(false);
  const allowCloseRef = useRef(false);
  const assistantId = assistantData?.apiAssistantId;
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

  // Mark a short window after opening to ignore accidental outside-click close
  useEffect(() => {
    if (open) {
      justOpenedRef.current = true;
      const t = setTimeout(() => {
        justOpenedRef.current = false;
      }, 250);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Sync local state when incoming data changes
  useEffect(() => {
    setLocalData(assistantData || null);
  }, [assistantData]);

  // Load assistant details from backend and prefill modal when opened
  useEffect(() => {
    const loadDetails = async () => {
      if (!open || !assistantId) return;
      try {
        setIsLoadingDetails(true);
        const details = await getAssistantById(assistantId);
        setLocalData((prev) => {
          const base = (prev || {}) as AssistantNodeData;
          return {
            ...base,
            name: details.name ?? base.name,
            systemMessage: details.systemPrompt ?? base.systemMessage,
            model: {
              ...(base.model || {}),
              provider: (details.llmProvider ? String(details.llmProvider).toLowerCase() : base.model?.provider),
              model: details.llmModel ?? base.model?.model,
              temperature: details.metadata?.temperature ?? base.model?.temperature,
              maxTokens: details.metadata?.maxTokens ?? base.model?.maxTokens,
            },
          } as AssistantNodeData;
        });
      } catch (err) {
        console.error('[AssistantConfigModal] Failed to load assistant details', err);
      } finally {
        setIsLoadingDetails(false);
      }
    };
    loadDetails();
  }, [open, assistantId]);

  // Handle model configuration changes (local only)
  const handleModelConfigChange = (field: string, value: any) => {
    // Mark as dirty on any local change
    isDirtyRef.current = true;
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
      } else if (field === 'temperature') {
        updated = {
          ...updated,
          model: {
            ...(updated.model || {}),
            temperature: typeof value === 'number' ? value : parseFloat(value),
          },
        } as AssistantNodeData;
      } else if (field === 'maxTokens') {
        updated = {
          ...updated,
          model: {
            ...(updated.model || {}),
            maxTokens: typeof value === 'number' ? value : parseInt(value, 10),
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

  // Debounced autosave whenever localData changes while the modal is open
  useEffect(() => {
    if (!open || !localData) return;
    // Do not autosave until the user actually edits something during this open session
    if (!isDirtyRef.current) return;
    const timer = setTimeout(async () => {
      try {
        if (assistantId) {
          await updateAssistant(assistantId, {
            name: localData.name,
            systemPrompt: localData.systemMessage,
            llmProvider: localData.model?.provider,
            llmModel: localData.model?.model,
            metadata: {
              temperature: localData.model?.temperature,
              maxTokens: localData.model?.maxTokens,
            },
          });
        }
      } catch (err) {
        console.error('[AssistantConfigModal] Autosave failed', err);
      }
      // Intentionally NOT calling onSave(localData) here because the parent closes
      // the modal on save. We persist to backend only to keep the modal open.
    }, 400);
    return () => clearTimeout(timer);
  }, [open, assistantId, localData]);

  // Only Instructions are shown now; removed tabs and extra sections.

  // Guarded onOpenChange to avoid immediate close on first frame
  const handleDialogOpenChange = (next: boolean) => {
    if (!next) {
      // Only allow closing when explicitly requested by the X button
      if (justOpenedRef.current) return; // ignore early close
      if (!allowCloseRef.current) return;
      // reset the flag after allowing close
      allowCloseRef.current = false;
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent 
        className="w-[96vw] max-w-[1400px] h-[66vh] p-0 overflow-hidden rounded-2xl border-0"
        onInteractOutside={() => { allowCloseRef.current = true; }}
      >
        <DialogHeader className="px-4 py-2.5 w-full bg-slate-300/60">
          <div className="flex items-center gap-1.5 w-full">
            {isEditingName && (
              // Visually hidden for a11y to ensure a DialogTitle exists
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
            {/* Right-aligned: only the X button */}
            <div className="flex-1" />
            <div className="flex items-center pr-2">
              <DialogClose className="ml-1" onClick={() => { allowCloseRef.current = true; }} />
            </div>
          </div>
        </DialogHeader>
        
        <div className={`grid grid-cols-[1fr_320px] h-[calc(100%-2.25rem)]`}>
          {/* Left side - Main content: only Instructions */}
          <div className="p-6 overflow-y-auto">
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">Instructions</h3>
                <Textarea 
                  className="min-h-[500px] font-normal text-sm bg-slate-50 w-full rounded-md" 
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
          <div className="p-4 bg-primary/5 overflow-y-auto">
            <div className="space-y-6">
              <div>
                <h3 className="font-medium mb-2">Generation settings</h3>
                <div className="space-y-3">
                  {/* AI model selector */}
                  <div className="bg-slate-100 rounded-lg px-3 py-2">
                    <label className="block text-xs text-slate-500 mb-1">AI model</label>
                    <Select
                      value={(localData?.model?.provider && localData?.model?.model) ? `${localData.model.provider}::${localData.model.model}` : undefined}
                      onValueChange={(v) => {
                        let [provider, model] = v.split('::');
                        // Normalize provider keys explicitly for non-OpenAI vendors
                        if (provider === 'xai') provider = 'xai';
                        if (provider === 'deepseek') provider = 'deepseek';
                        handleModelConfigChange('model', { provider, model });
                      }}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Select a model" />
                      </SelectTrigger>
                      <SelectContent className="border-0 shadow-lg rounded-md">
                        <SelectItem value="openai::gpt-4o">openai-gpt-4o</SelectItem>
                        <SelectItem value="openai::gpt-4o-mini">openai-gpt-4o mini</SelectItem>
                        <SelectItem value="openai::gpt-4-turbo">openai-gpt-4 turbo</SelectItem>
                        <SelectItem value="openai::gpt-4">openai-gpt-4</SelectItem>
                        <SelectItem value="openai::gpt-3.5-turbo">openai-gpt-3.5 turbo</SelectItem>
                        <SelectItem value="openai::o1">openai-o1</SelectItem>
                        <SelectItem value="openai::o1-mini">openai-o1 mini</SelectItem>
                        <SelectItem value="anthropic::claude-3.5-sonnet">anthropic-claude-3.5-sonnet</SelectItem>
                        <SelectItem value="anthropic::claude-3.5-haiku">anthropic-claude-3.5-haiku</SelectItem>
                        <SelectItem value="anthropic::claude-3-opus">anthropic-claude-3-opus</SelectItem>
                        <SelectItem value="anthropic::claude-3.7-sonnet">anthropic-claude-3.7-sonnet</SelectItem>
                        <SelectItem value="anthropic::claude-4-sonnet">anthropic-claude-4-sonnet</SelectItem>
                        <SelectItem value="anthropic::claude-4-opus">anthropic-claude-4-opus</SelectItem>
                        <SelectItem value="google::gemini-2.5-pro">google-gemini-2.5-pro</SelectItem>
                        <SelectItem value="google::gemini-2.5-flash">google-gemini-2.5-flash</SelectItem>
                        <SelectItem value="google::gemini-2.0-flash">google-gemini-2.0-flash</SelectItem>
                        <SelectItem value="xai::grok-3">xai-grok-3</SelectItem>
                        <SelectItem value="xai::grok-3-mini">xai-grok-3 mini</SelectItem>
                        <SelectItem value="xai::grok-2">xai-grok-2</SelectItem>
                        <SelectItem value="deepseek::r1-distill-llama-70b">deepseek-r1 distill llama 70b</SelectItem>
                        <SelectItem value="meta::llama-3.1-instant">meta-llama 3.1 instant</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between gap-3 bg-slate-100 rounded-lg px-3 py-2">
                    <label className="text-sm text-muted-foreground">Temperature</label>
                    <Input
                      type="number"
                      step="0.1"
                      min={0}
                      max={2}
                      className="w-28 h-8"
                      value={localData?.model?.temperature ?? ''}
                      onChange={(e) => handleModelConfigChange('temperature', e.target.value)}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 bg-slate-100 rounded-lg px-3 py-2">
                    <label className="text-sm text-muted-foreground">Max tokens</label>
                    <Input
                      type="number"
                      min={1}
                      className="w-28 h-8"
                      value={localData?.model?.maxTokens ?? ''}
                      onChange={(e) => handleModelConfigChange('maxTokens', e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div>
                <h3 className="font-medium mb-2">Tools</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-slate-200">
                    <div className="w-5 h-5 flex items-center justify-center bg-blue-200 rounded-full text-blue-900 text-xs">Z</div>
                    <span className="text-xs">Zendesk</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-slate-200">
                    <div className="w-5 h-5 flex items-center justify-center bg-green-200 rounded-full text-green-900 text-xs">G</div>
                    <span className="text-xs">Google Sheets</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-slate-200">
                    <div className="w-5 h-5 flex items-center justify-center bg-blue-200 rounded-full text-blue-900 text-xs">S</div>
                    <span className="text-xs">Salesforce</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-slate-200">
                    <div className="w-5 h-5 flex items-center justify-center bg-red-200 rounded-full text-red-900 text-xs">G</div>
                    <span className="text-xs">Gmail</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-slate-200">
                    <div className="w-5 h-5 flex items-center justify-center bg-purple-200 rounded-full text-purple-900 text-xs">A</div>
                    <span className="text-xs">Airtable</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-slate-200">
                    <div className="w-5 h-5 flex items-center justify-center bg-indigo-200 rounded-full text-indigo-900 text-xs">M</div>
                    <span className="text-xs">Make</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-slate-200">
                    <div className="w-5 h-5 flex items-center justify-center bg-cyan-200 rounded-full text-cyan-900 text-xs">T</div>
                    <span className="text-xs">Twilio</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-slate-200">
                    <div className="w-5 h-5 flex items-center justify-center bg-orange-200 rounded-full text-orange-900 text-xs">H</div>
                    <span className="text-xs">Hubspot</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="font-medium mb-2">Knowledge base</h3>
                <div className="flex items-center justify-between bg-slate-100 rounded-lg px-3 py-2">
                  <span className="text-sm">Enabled</span>
                  <Switch id="kb-sidebar" />
                </div>
              </div>
              
              <div>
                <h3 className="font-medium mb-2">Buttons</h3>
                <div className="flex items-center justify-between bg-slate-100 rounded-lg px-3 py-2">
                  <span className="text-sm">Enabled</span>
                  <Switch id="buttons-enabled" />
                </div>
              </div>
              
              <div>
                <h3 className="font-medium mb-2">Cards</h3>
                <div className="flex items-center justify-between bg-slate-100 rounded-lg px-3 py-2">
                  <span className="text-sm">Enabled</span>
                  <Switch id="cards-enabled" />
                </div>
              </div>
              
              <div>
                <h3 className="font-medium mb-2">Carousels</h3>
                <div className="flex items-center justify-between bg-slate-100 rounded-lg px-3 py-2">
                  <span className="text-sm">Enabled</span>
                  <Switch id="carousels-enabled" />
                </div>
              </div>
              
              <div>
                <h3 className="font-medium mb-2">Exit conditions</h3>
                <div className="flex items-center justify-between bg-slate-100 rounded-lg px-3 py-2">
                  <span className="text-sm">New exit condition (inactive)</span>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-full">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
