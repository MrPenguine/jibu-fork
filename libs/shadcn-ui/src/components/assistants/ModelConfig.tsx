"use client"

import { useState, useEffect } from "react"
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
import { getAvailableModels, CategorizedModels, ModelInfo } from "../../../../../apps/frontend/src/utils/AssistantsApi"

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
  if (KNOWN_CAPABLE_MODELS.includes(modelId)) return 'Most Capable';
  return 'Standard';
};

interface ModelConfigProps {
  firstMessage: string
  systemPrompt: string
  provider: string
  model: string
  temperature: number
  maxTokens: number
  assistantId?: string
  knowledgeBaseId?: string
  organizationId?: string
  onFirstMessageChange: (value: string) => void
  onSystemPromptChange: (value: string) => void
  onProviderChange: (value: string) => void
  onModelChange: (value: string) => void
  onTemperatureChange: (value: number) => void
  onMaxTokensChange: (value: number) => void
  onKnowledgeBaseChange?: (knowledgeBaseId: string | null) => void
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
  onFirstMessageChange,
  onSystemPromptChange,
  onProviderChange,
  onModelChange,
  onTemperatureChange,
  onMaxTokensChange,
  onKnowledgeBaseChange
}: ModelConfigProps) {
  // State for models
  const [models, setModels] = useState<CategorizedModels | null>(null)
  const [filteredModels, setFilteredModels] = useState<ModelInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Add information about the current connection
  const connectedKbInfo = knowledgeBaseId ? 
    `Assistant connected to knowledge base: ${knowledgeBaseId}` : 
    "No knowledge base connected";

  // Load models on component mount
  useEffect(() => {
    const fetchModels = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Fetch models using the getAvailableModels function from AssistantsApi
        const data = await getAvailableModels()
        console.log('[ModelConfig] Fetched models:', Object.keys(data))
        
        // Check if we actually got models
        if (!data || Object.keys(data).length === 0) {
          console.warn('[ModelConfig] No models returned from API')
          setError("No models available. Using default configuration.")
          // We'll still allow the component to function by using a minimal set
          const fallbackData = {
            openai: [{
              id: 'openai/gpt-3.5-turbo',
              name: 'GPT-3.5 Turbo',
              contextLength: 16000,
              description: 'General purpose model from OpenAI'
            }]
          }
          setModels(fallbackData)
          // Apply filtering and sorting to the fallback data
          const processed = filterAndSortModels(fallbackData, modelPreference)
          setFilteredModels(processed)
          
          // Auto-select if needed
          if (!model || !provider) {
            if (!provider) {
              console.log(`[ModelConfig] Auto-selecting fallback provider: openai`)
              onProviderChange('openai')
            }
            
            if (!model) {
              console.log(`[ModelConfig] Auto-selecting fallback model: openai/gpt-3.5-turbo`)
              onModelChange('openai/gpt-3.5-turbo')
            }
          }
        } else {
          setModels(data)
          
          // Apply filtering and sorting
          const processed = filterAndSortModels(data, provider)
          console.log('[ModelConfig] Processed models count:', processed.length)
          setFilteredModels(processed)
          
          // Auto-select if needed
          if ((!model || !provider) && processed.length > 0) {
            const firstModel = processed[0]
            const firstProvider = firstModel.id.split('/')[0]
            
            if (!provider) {
              console.log(`[ModelConfig] Auto-selecting provider: ${firstProvider}`)
              onProviderChange(firstProvider)
            }
            
            if (!model) {
              console.log(`[ModelConfig] Auto-selecting model: ${firstModel.id}`)
              onModelChange(firstModel.id)
            }
          }
        }
      } catch (err: any) {
        console.error("[ModelConfig] Error fetching models:", err)
        const errorMessage = err.message || "Failed to load models from the server."
        setError(`${errorMessage} Using default configuration.`)
        
        // Provide a minimal fallback
        const fallbackData = {
          openai: [{
            id: 'openai/gpt-3.5-turbo',
            name: 'GPT-3.5 Turbo',
            contextLength: 16000,
            description: 'General purpose model from OpenAI'
          }]
        }
        setModels(fallbackData)
        const processed = filterAndSortModels(fallbackData, provider)
        setFilteredModels(processed)
        
        // Auto-select the fallback model if needed
        if (!model) {
          const fallbackModelId = 'openai/gpt-3.5-turbo'
          console.log(`[ModelConfig] Auto-selecting fallback model: ${fallbackModelId}`)
          onModelChange(fallbackModelId)
        }
        
        // Auto-select provider if needed
        if (!provider) {
          const fallbackProvider = 'openai'
          console.log(`[ModelConfig] Auto-selecting fallback provider: ${fallbackProvider}`)
          onProviderChange(fallbackProvider)
        }
        
        // Schedule a retry after 30 seconds
        const retryTimeout = setTimeout(() => {
          console.log('[ModelConfig] Retrying model fetch...')
          fetchModels()
        }, 30000)
        
        return () => clearTimeout(retryTimeout)
      } finally {
        setLoading(false)
      }
    }
    
    fetchModels()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onModelChange, onProviderChange])
  
  // Update filtered models when provider changes
  useEffect(() => {
    if (models) {
      const processed = filterAndSortModels(models, provider)
      setFilteredModels(processed)
    }
  }, [models, provider])

  // No longer using model preference handlers
  
  // Format provider name for display
  const formatProviderName = (providerKey: string) => {
    switch(providerKey) {
      case 'openai': return 'OpenAI'
      case 'google': return 'Google'
      case 'anthropic': return 'Anthropic'
      case 'mistralai': return 'Mistral AI'
      case 'groq': return 'Groq'
      case 'meta': return 'Meta AI'
      case 'cohere': return 'Cohere'
      case 'x-ai': return 'X AI' // Added X AI (Grok)
      case 'other': return 'Other Providers'
      default: return providerKey.charAt(0).toUpperCase() + providerKey.slice(1)
    }
  }
  
  // Get current model name and info for display
  const currentModel = model ? filteredModels.find(m => m.id === model) : null
  const currentModelName = currentModel?.name || model || "Select model"
  
  // Get current provider name for display
  const currentProviderName = provider ? formatProviderName(provider) : "Select provider"
  
  // No longer using preference label function
  
  // Handler for model selection to ensure proper state updates
  const handleModelSelection = (modelInfo: ModelInfo) => {
    // Determine the provider based on the model ID
    let modelProvider = '';
    
    if (modelInfo.id.startsWith('gemini-')) {
      modelProvider = 'google';
    } else if (modelInfo.id.startsWith('x-ai/')) {
      modelProvider = 'x-ai';
    } else if (modelInfo.id.startsWith('mistral-') || 
               modelInfo.id === 'codestral-latest' || 
               modelInfo.id === 'ministral-3b-latest') {
      modelProvider = 'mistralai';
    }
    
    console.log(`[ModelConfig] User selected model: ${modelInfo.id}, provider: ${modelProvider}`);
    
    // Update provider first, then model
    onProviderChange(modelProvider);
    onModelChange(modelInfo.id);
  };
  
  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex">
        {/* Main Configuration Area */}
        <div className="w-2/3 pr-6">
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
              onChange={(e) => onFirstMessageChange(e.target.value)}
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
                onChange={(e) => onSystemPromptChange(e.target.value)}
                rows={6}
              />
              <div className="absolute top-2 right-2">
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M15 3H21M21 3V9M21 3L14 10M10 21H4M4 21V15M4 21L11 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </Button>
              </div>
            </div>
            <div className="mt-2 flex justify-end">
              <Button size="sm" variant="outline" className="text-xs">
                Generate
              </Button>
            </div>
          </div>
          
          {/* Knowledge Base Section - Title moved outside component */}
          <div className="mt-6">
            <div className="flex items-center mb-2">
              <h2 className="text-xl font-bold">Knowledge Base</h2>
              <div className="ml-2 text-muted-foreground">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 15V17M12 7V13M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-3">{connectedKbInfo}</p>
            
            {/* Knowledge Base Component - Made wider with width of 100% */}
            <div className="w-full">
              <KnowledgeBaseConfig
                assistantId={assistantId}
                knowledgeBaseId={knowledgeBaseId}
                organizationId={organizationId}
                onKnowledgeBaseChange={onKnowledgeBaseChange}
              />
            </div>
          </div>
        </div>
        
        {/* Right Settings Panel */}
        <div className="w-1/3 pl-6 space-y-6">
          {/* Provider Selection */}
          <div>
            <div className="flex items-center mb-2">
              <label className="block text-xs font-bold uppercase">Provider</label>
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
                {loading ? (
                  <DropdownMenuItem disabled>Loading providers...</DropdownMenuItem>
                ) : error ? (
                  <DropdownMenuItem disabled>Error loading providers</DropdownMenuItem>
                ) : (
                  SUPPORTED_PROVIDERS.map(providerKey => {
                    let modelCount = 0;
                    
                    // Count models for this provider
                    if (models) {
                      if (providerKey === 'google') {
                        // Count Google/Gemini models
                        modelCount = Object.values(models).flat().filter(model => 
                          model.id.startsWith('gemini-')
                        ).length;
                      } else if (providerKey === 'x-ai' && models['xai']) {
                        // Count X AI models
                        modelCount = models['xai'].length;
                      } else if (providerKey === 'mistralai' && models['mistralai']) {
                        // Count Mistral models
                        modelCount = models['mistralai'].length;
                      }
                    }
                    
                    // Only show providers with available models
                    if (modelCount > 0) {
                      return (
                        <DropdownMenuItem 
                          key={providerKey} 
                          onClick={() => onProviderChange(providerKey)}
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
          <div>
            <div className="flex items-center mb-2">
              <label className="block text-xs font-bold uppercase">Model</label>
              <div className="ml-2 text-muted-foreground">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 15V17M12 7V13M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full bg-white rounded-full border justify-between">
                  {loading ? "Loading..." : currentModelName}
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="ml-2 h-4 w-4">
                    <path d="M4.5 6.5L7.5 9.5L10.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                  </svg>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" sideOffset={4} className="w-full border-0 max-h-[300px] overflow-y-auto">
                {loading ? (
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
          
          <div>
            <div className="flex items-center mb-2">
              <label className="block text-xs font-bold uppercase">Temperature</label>
              <div className="ml-2 text-muted-foreground">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 15V17M12 7V13M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Slider 
                className="w-full" 
                value={[temperature]} 
                min={0} 
                max={1} 
                step={0.1}
                onValueChange={(values) => onTemperatureChange(values[0])}
              />
              <span className="ml-2">{temperature}</span>
            </div>
          </div>
          
          <div>
            <div className="flex items-center mb-2">
              <label className="block text-xs font-bold uppercase">Max Tokens</label>
              <div className="ml-2 text-muted-foreground">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 15V17M12 7V13M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
            <Input 
              type="number" 
              className="w-full bg-white rounded-full border" 
              value={maxTokens}
              onChange={(e) => onMaxTokensChange(parseInt(e.target.value))}
            />
          </div>
        </div>
      </div>
    </div>
  )
} 