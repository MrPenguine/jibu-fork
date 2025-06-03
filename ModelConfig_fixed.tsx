"use client"

import { useState, useEffect, useCallback } from "react"
import { Textarea } from "@libs/shadcn-ui/components/ui/textarea"
import { Button } from "@libs/shadcn-ui/components/ui/button"
import { Slider } from "@libs/shadcn-ui/components/ui/slider"
import { Input } from "@libs/shadcn-ui/components/ui/input"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem
} from "@libs/shadcn-ui/components/ui/dropdown-menu"
import { KnowledgeBaseConfig } from "./KnowledgeBaseConfig"
import { getAvailableModels, CategorizedModels, ModelInfo, updateAssistant } from "../../../../../apps/frontend/src/utils/AssistantsApi"
import { format } from "date-fns"

// Minimum context length for filtering
const MIN_CONTEXT_LENGTH = 8192;

// Known fast models for streaming
const KNOWN_FAST_MODELS = [
  // Grok models
  'x-ai/grok-3-fast-latest',
  'x-ai/grok-3-mini-fast-latest',
  // Google models - only include models available in your account
  'google/gemini-2.0-flash',
  'google/gemini-2.0-flash-lite',
  // Mistral models
  'mistralai/mistral-small-latest',
  'mistralai/codestral-latest',
  'mistralai/ministral-3b-latest'
];

// Known balanced models (good performance/speed trade-off)
const KNOWN_BALANCED_MODELS = [
  // Grok models
  'x-ai/grok-3-latest',
  'x-ai/grok-3-mini-latest',
  'x-ai/grok-2-vision-latest',
  // Google models - only include models available in your account
  'google/gemini-1.5-pro',
  // Mistral models
  'mistralai/mistral-large-latest',
  'mistralai/mistral-medium-latest'
];

// Known capable models (highest quality, may be slower)
const KNOWN_CAPABLE_MODELS: string[] = [
  // Currently none - we're focusing on Grok and Gemini
];

// List of supported providers - only include the main ones we want to show
const SUPPORTED_PROVIDERS = ['google', 'x-ai', 'mistralai'];

// Function to filter and sort models
const filterAndSortModels = (
  models: CategorizedModels,
  selectedProvider?: string
): ModelInfo[] => {
  // Collect all models into a single array
  const allModels: ModelInfo[] = [];
  Object.entries(models).forEach(([_, modelList]) => {
    if (modelList && modelList.length > 0) {
      allModels.push(...modelList);
    }
  });
  
  // Filter models based on provider
  const filteredModels = allModels.filter(model => {
    // Filter by provider if specified
    if (selectedProvider) {
      // Handle Google models (gemini-*)
      if (selectedProvider === 'google' && model.id.startsWith('gemini-')) {
        return true;
      }
      
      // Handle X AI models (x-ai/*)
      if (selectedProvider === 'x-ai' && model.id.startsWith('x-ai/')) {
        return true;
      }
      
      // Handle Mistral models (mistral-*) - without provider prefix
      if (selectedProvider === 'mistralai' && (
        model.id.startsWith('mistral-') || 
        model.id === 'codestral-latest' || 
        model.id === 'ministral-3b-latest'
      )) {
        return true;
      }
      
      // No match for this provider
      return false;
    }
    
    return true;
  });
  
  // Sort models by name and capability
  filteredModels.sort((a, b) => {
    // Sort by provider priority (XAI/Grok first, then Groq for speed)
    const providerA = a.id.split('/')[0];
    const providerB = b.id.split('/')[0];
    
    // Prioritize XAI (Grok) models
    if (providerA === 'x-ai' && providerB !== 'x-ai') return -1;
    if (providerA !== 'x-ai' && providerB === 'x-ai') return 1;
    
    // Then prioritize Groq for speed
    if (providerA === 'groq' && providerB !== 'groq') return -1;
    if (providerA !== 'groq' && providerB === 'groq') return 1;
    
    // Finally, alphabetical by name
    return a.name.localeCompare(b.name);
  });
  
  return filteredModels;
};

// Function to get model speed tier
const getModelSpeedTier = (modelId: string): string => {
  if (KNOWN_FAST_MODELS.includes(modelId)) return 'Fastest';
  if (KNOWN_BALANCED_MODELS.includes(modelId)) return 'Balanced';
  if (KNOWN_CAPABLE_MODELS.includes(modelId)) return 'Capable';
  return 'Standard';
};

// Define props interface
interface ModelConfigProps {
  firstMessage: string;
  systemPrompt: string;
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  assistantId?: string;
  knowledgeBaseId?: string;
  organizationId?: string;
  modelPreference?: 'latency' | 'balance' | 'capability';
  onFirstMessageChange: (value: string) => void;
  onSystemPromptChange: (value: string) => void;
  onProviderChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onTemperatureChange: (value: number) => void;
  onMaxTokensChange: (value: number) => void;
  onModelPreferenceChange?: (value: 'latency' | 'balance' | 'capability') => void;
  onKnowledgeBaseChange?: (knowledgeBaseId: string | null) => void;
}

export function ModelConfig({
  firstMessage,
  systemPrompt,
  provider,
  model,
  temperature,
  maxTokens,
  assistantId,
  knowledgeBaseId,
  organizationId,
  modelPreference = 'latency',
  onFirstMessageChange,
  onSystemPromptChange,
  onProviderChange,
  onModelChange,
  onTemperatureChange,
  onMaxTokensChange,
  onModelPreferenceChange,
  onKnowledgeBaseChange
}: ModelConfigProps) {
  // State for models
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [models, setModels] = useState<CategorizedModels>({});
  
  // Autosave state
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  
  // Debounced save function
  const debouncedSave = useCallback(
    async (data: any) => {
      if (!assistantId || assistantId === 'new') return;
      
      setSaving(true);
      try {
        const updated = await updateAssistant(assistantId, data);
        setLastSaved(new Date(updated.updatedAt));
        setIsDirty(false);
      } catch (error) {
        console.error('Failed to autosave:', error);
      } finally {
        setSaving(false);
      }
    },
    [assistantId]
  );
  
  // Function to fetch available models
  const fetchModels = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Attempt to fetch models from API
      const fetchedModels = await getAvailableModels(organizationId);
      
      // Check if we got valid data
      if (fetchedModels && Object.keys(fetchedModels).length > 0) {
        setModels(fetchedModels);
      } else {
        // If no models returned, use fallback data
        console.warn('No models returned from API, using fallback data');
        
        // Create fallback model data
        const fallbackModels: CategorizedModels = {
          'x-ai': [
            { id: 'x-ai/grok-3-latest', name: 'Grok 3', contextLength: 128000 },
            { id: 'x-ai/grok-3-mini-latest', name: 'Grok 3 Mini', contextLength: 32000 },
            { id: 'x-ai/grok-3-fast-latest', name: 'Grok 3 Fast', contextLength: 128000 },
            { id: 'x-ai/grok-3-mini-fast-latest', name: 'Grok 3 Mini Fast', contextLength: 32000 },
            { id: 'x-ai/grok-2-vision-latest', name: 'Grok 2 Vision', contextLength: 32000 }
          ],
          'google': [
            { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', contextLength: 1000000 },
            { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', contextLength: 128000 },
            { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', contextLength: 32000 }
          ],
          'mistralai': [
            { id: 'mistral-large-latest', name: 'Mistral Large', contextLength: 32000 },
            { id: 'mistral-medium-latest', name: 'Mistral Medium', contextLength: 32000 },
            { id: 'mistral-small-latest', name: 'Mistral Small', contextLength: 32000 },
            { id: 'codestral-latest', name: 'Codestral', contextLength: 32000 },
            { id: 'ministral-3b-latest', name: 'Ministral 3B', contextLength: 8000 }
          ]
        };
        
        setModels(fallbackModels);
      }
    } catch (error) {
      console.error('Error fetching models:', error);
      setError('Failed to load models. Please try again later.');
      
      // Try again in 5 seconds
      setTimeout(() => {
        fetchModels();
      }, 5000);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch models on component mount
  useEffect(() => {
    fetchModels();
  }, [organizationId]);
  
  // Filter models based on selected provider
  const filteredModels = filterAndSortModels(models, provider);
  
  // Get current model name for display
  const currentModelName = (() => {
    // Find the model in the filtered list
    const modelInfo = filteredModels.find(m => m.id === model);
    if (modelInfo) return modelInfo.name;
    
    // If not found, try to create a readable name from the ID
    if (model) {
      const parts = model.split('/');
      const modelName = parts[parts.length - 1]
        .replace(/-/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
      return modelName;
    }
    
    return 'Select a model';
  })();
  
  // Get current provider name for display
  const currentProviderName = formatProviderName(provider);
  
  // Format date for display
  const formatDateTime = (date: Date | null) => {
    if (!date) return '';
    return format(date, 'h:mm a');
  };
  
  // Knowledge base connection info
  const connectedKbInfo = knowledgeBaseId 
    ? "This assistant is connected to a knowledge base."
    : "This assistant is not connected to a knowledge base.";
  
  // Format provider name for display
  const formatProviderName = (providerKey: string) => {
    if (!providerKey) return 'Select a provider';
    
    switch (providerKey) {
      case 'x-ai':
        return 'X AI (Grok)';
      case 'google':
        return 'Google AI (Gemini)';
      case 'mistralai':
        return 'Mistral AI';
      case 'anthropic':
        return 'Anthropic (Claude)';
      case 'openai':
        return 'OpenAI (GPT)';
      case 'groq':
        return 'Groq';
      default:
        // Capitalize provider name
        return providerKey.charAt(0).toUpperCase() + providerKey.slice(1);
    }
  };
  
  // Handler for model selection to ensure proper state updates
  const handleModelSelection = (modelInfo: ModelInfo) => {
    onModelChange(modelInfo.id);
    
    // Trigger autosave if we have a valid assistantId
    if (assistantId && assistantId !== 'new') {
      setIsDirty(true);
      debouncedSave({ model: { model: modelInfo.id } });
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      {/* Autosave status indicator */}
      {assistantId && assistantId !== 'new' && (
        <div className="flex items-center justify-end text-sm text-muted-foreground mb-4">
          {saving ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Saving...
            </span>
          ) : isDirty ? (
            <span>Unsaved changes</span>
          ) : lastSaved ? (
            <span>Last saved: {formatDateTime(lastSaved)}</span>
          ) : null}
        </div>
      )}
      <div className="space-y-6">
        {/* Main Configuration Area */}
        <div>
          <div className="flex items-center mb-2">
            <h2 className="text-xl font-bold">Model</h2>
            <div className="ml-2 text-muted-foreground">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 15V17M12 7V13M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-6">Configure the behavior of the assistant. {connectedKbInfo}</p>
          
          {/* First Message */}
          <div className="mb-6">
            <div className="flex items-center mb-2">
              <label className="block text-xs font-bold uppercase">First Message</label>
              <div className="ml-2 text-muted-foreground">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 15V17M12 7V13M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
            <Textarea 
              className="w-full" 
              value={firstMessage}
              onChange={(e) => {
                onFirstMessageChange(e.target.value);
                if (assistantId && assistantId !== 'new') {
                  setIsDirty(true);
                  debouncedSave({ description: e.target.value });
                }
              }}
              rows={3}
            />
          </div>
          
          {/* System Prompt */}
          <div className="mb-6">
            <div className="flex items-center mb-2">
              <label className="block text-xs font-bold uppercase">System Prompt</label>
              <div className="ml-2 text-muted-foreground">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 15V17M12 7V13M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
            <div className="relative">
              <Textarea 
                className="w-full pr-10" 
                value={systemPrompt}
                onChange={(e) => {
                  onSystemPromptChange(e.target.value);
                  if (assistantId && assistantId !== 'new') {
                    setIsDirty(true);
                    debouncedSave({ systemPrompt: e.target.value });
                  }
                }}
                rows={6}
              />
              <div className="absolute top-2 right-2">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => onSystemPromptChange("")}
                >
                  Clear
                </Button>
              </div>
            </div>
            <div className="mt-2 flex justify-end">
              <span className="text-xs text-muted-foreground">
                {systemPrompt.length} characters
              </span>
            </div>
          </div>
          
          {/* Knowledge Base Selection */}
          <div className="mt-6">
            <div className="flex items-center mb-2">
              <label className="block text-xs font-bold uppercase">Knowledge Base</label>
              <div className="ml-2 text-muted-foreground">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 15V17M12 7V13M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
            
            <div className="w-full">
              {onKnowledgeBaseChange && (
                <KnowledgeBaseConfig 
                  knowledgeBaseId={knowledgeBaseId}
                  onKnowledgeBaseChange={onKnowledgeBaseChange}
                />
              )}
            </div>
          </div>
        </div>
        
        {/* Right Settings Panel */}
        <div className="w-1/3 pl-6 space-y-8">
          {/* LLM Provider Selection */}
          <div>
            <div className="flex items-center mb-2">
              <label className="block text-xs font-bold uppercase">LLM Provider</label>
              <div className="ml-2 text-muted-foreground">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 15V17M12 7V13M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full bg-white rounded-full border justify-between">
                  {currentProviderName}
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="ml-2 h-4 w-4">
                    <path d="M4.5 6.5L7.5 9.5L10.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                  </svg>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" sideOffset={4} className="w-full border-0">
                {isLoading ? (
                  <DropdownMenuItem disabled>Loading providers...</DropdownMenuItem>
                ) : error ? (
                  <DropdownMenuItem disabled>Error loading providers</DropdownMenuItem>
                ) : (
                  SUPPORTED_PROVIDERS.map((providerKey) => {
                    // Count available models for this provider
                    const providerModels = models[providerKey] || [];
                    const modelCount = providerModels.length;
                    
                    if (modelCount > 0) {
                      return (
                        <DropdownMenuItem 
                          key={providerKey} 
                          onClick={() => {
                            onProviderChange(providerKey);
                            if (assistantId && assistantId !== 'new') {
                              setIsDirty(true);
                              debouncedSave({ model: { provider: providerKey } });
                            }
                          }}
                          className="py-2"
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{formatProviderName(providerKey)}</span>
                            <span className="text-xs text-muted-foreground">{modelCount} models available</span>
                          </div>
                        </DropdownMenuItem>
                      );
                    }
                    return null;
                  })
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          {/* Model Selection */}
          <div className="flex flex-col items-center">
            <div className="w-full text-center mb-4">
              <h2 className="text-xl font-bold">AI Model</h2>
              <p className="text-sm text-muted-foreground mt-1">Choose the specific model to power your assistant</p>
            </div>
            <div className="w-full max-w-md mx-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full bg-white rounded-full border justify-between py-6 text-lg">
                    {isLoading ? "Loading..." : currentModelName}
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="ml-2 h-4 w-4">
                      <path d="M4.5 6.5L7.5 9.5L10.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                    </svg>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" sideOffset={4} className="w-full border-0 max-h-[300px] overflow-y-auto">
                  {isLoading ? (
                    <DropdownMenuItem disabled>Loading models...</DropdownMenuItem>
                  ) : error ? (
                    <DropdownMenuItem disabled>Error loading models</DropdownMenuItem>
                  ) : filteredModels.length === 0 ? (
                    <DropdownMenuItem disabled>No models available</DropdownMenuItem>
                  ) : (
                    filteredModels.map((modelInfo: ModelInfo) => {
                      // Get provider name for display
                      let displayProvider = '';
                      if (modelInfo.id.startsWith('gemini-')) {
                        displayProvider = 'Google';
                      } else if (modelInfo.id.startsWith('x-ai/')) {
                        displayProvider = 'X AI';
                      } else if (modelInfo.id.startsWith('mistral-') || 
                                 modelInfo.id === 'codestral-latest' || 
                                 modelInfo.id === 'ministral-3b-latest') {
                        displayProvider = 'Mistral AI';
                      } else {
                        const provider = modelInfo.id.split('/')[0];
                        displayProvider = formatProviderName(provider);
                      }
                      
                      const speedTier = getModelSpeedTier(modelInfo.id);
                      
                      return (
                        <DropdownMenuItem 
                          key={modelInfo.id} 
                          onClick={() => handleModelSelection(modelInfo)}
                          className="flex flex-col items-start w-full py-3"
                        >
                          <div className="font-medium">{modelInfo.name}</div>
                          <div className="text-xs text-muted-foreground mt-1 w-full flex justify-between">
                            <span>{displayProvider}</span>
                            <span>{speedTier}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 w-full">
                            Context: {modelInfo.contextLength.toLocaleString()} tokens
                          </div>
                        </DropdownMenuItem>
                      );
                    })
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
          <div className="flex flex-col items-center">
            <div className="w-full text-center mb-4">
              <h2 className="text-xl font-bold">Temperature</h2>
              <p className="text-sm text-muted-foreground mt-1">Control creativity vs. predictability</p>
            </div>
            <div className="w-full max-w-md mx-auto">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm">Precise</span>
                <span className="text-sm">Creative</span>
              </div>
              <div className="flex items-center justify-between">
                <Slider 
                  className="w-full" 
                  value={[temperature]} 
                  min={0} 
                  max={1} 
                  step={0.1}
                  onValueChange={(values) => {
                    onTemperatureChange(values[0]);
                    if (assistantId && assistantId !== 'new') {
                      setIsDirty(true);
                      debouncedSave({ model: { temperature: values[0] } });
                    }
                  }}
                />
              </div>
              <div className="text-center mt-2">
                <span className="text-lg font-medium">{temperature}</span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col items-center">
            <div className="w-full text-center mb-4">
              <h2 className="text-xl font-bold">Max Tokens</h2>
              <p className="text-sm text-muted-foreground mt-1">Set the maximum response length</p>
            </div>
            <div className="w-full max-w-md mx-auto">
              <Input 
                type="number" 
                className="w-full bg-white rounded-full border text-center text-lg py-6" 
                value={maxTokens}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  onMaxTokensChange(value);
                  if (assistantId && assistantId !== 'new') {
                    setIsDirty(true);
                    debouncedSave({ model: { maxTokens: value } });
                  }
                }}
              />
              <p className="text-xs text-muted-foreground mt-2 text-center">Higher values allow longer responses but may use more resources</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
