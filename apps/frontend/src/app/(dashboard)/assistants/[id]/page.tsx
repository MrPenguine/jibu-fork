"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@libs/shadcn-ui/components/ui/tabs"
import { ModelConfig } from "@libs/shadcn-ui/components/assistants/ModelConfig"
import { LatencyCard } from "libs/shadcn-ui/src/components/assistants/LatencyCard"
import { CostCard } from "libs/shadcn-ui/src/components/assistants/CostCard"
import { AssistantHeader } from "libs/shadcn-ui/src/components/assistants/AssistantHeader"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@libs/shadcn-ui/components/ui/dropdown-menu"
import { Button } from "@libs/shadcn-ui/components/ui/button"
import React from "react"
import { getAssistant, updateAssistant, Assistant } from "../../../../utils/AssistantsApi"
import { useOrganization } from "../../../../utils/organizationContext"
import { format } from "date-fns"

type ProviderType = "web" | "twilio" | "vonage";

// Define the apiProviders array
const apiProviders = [
  { name: "OpenAI", value: "openai" },
  { name: "Anthropic", value: "anthropic" }
]

export default function AssistantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { activeOrganization } = useOrganization();
  
  // Safely extract the ID using React.use() as recommended
  const id = typeof params?.id === 'string' ? params.id : 
             Array.isArray(params?.id) ? params.id[0] : 'new';
  
  // State for assistant data
  const [assistant, setAssistant] = useState<Assistant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for editable fields
  const [name, setName] = useState('');
  const [assistantName, setAssistantName] = useState(''); // Used for display
  const [firstMessage, setFirstMessage] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [provider, setProvider] = useState<string>('');
  const [model, setModel] = useState<string>('');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2048);
  
  // State for UI
  const [selectedProvider, setSelectedProvider] = useState<ProviderType>('web');
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [knowledgeBaseId, setKnowledgeBaseId] = useState<string | null>(null);
  
  // Load assistant data based on ID
  useEffect(() => {
    if (id === 'new') {
      setIsLoading(false);
      return;
    }
    
    if (!id || !activeOrganization) return;
    
    const fetchAssistant = async () => {
      setIsLoading(true);
      
      try {
        const assistantData = await getAssistant(id);
        
        // Check if the assistant belongs to the current organization
        if (assistantData.organizationId !== activeOrganization.id) {
          console.log(`Assistant ${id} does not belong to organization ${activeOrganization.id}, redirecting...`);
          // Don't set the error state, silently redirect
          router.push('/assistants');
          return;
        }
        
        setAssistant(assistantData);
        
        // Set state with data from assistant
        setName(assistantData.name);
        setFirstMessage(assistantData.firstMessage || '');
        setSystemPrompt(assistantData.voicemailMessage || ''); // voicemailMessage from API maps to systemPrompt in UI
        setAssistantName(assistantData.name);
        
        // Set model config if available
        if (assistantData.model) {
          if (typeof assistantData.model === 'string') {
            setModel(assistantData.model);
          } else if (typeof assistantData.model === 'object' && assistantData.model.name) {
            setModel(assistantData.model.name);
          }
          
          // Set temperature and maxTokens if available
          if (typeof assistantData.model === 'object') {
            if (assistantData.model.temperature !== undefined) {
              setTemperature(assistantData.model.temperature);
            }
            if (assistantData.model.maxTokens !== undefined) {
              setMaxTokens(assistantData.model.maxTokens);
            }
          }
        }
        
        // Set provider if available, default to the first provider otherwise
        setProvider((assistantData as any).provider || (apiProviders.length > 0 ? apiProviders[0].value : ''));
        
        // Set knowledge base ID if available
        setKnowledgeBaseId(assistantData.knowledgeBaseId || null);
        
        // Set last saved time from updatedAt
        if (assistantData.updatedAt) {
          setLastSaved(new Date(assistantData.updatedAt));
        }
      } catch (error) {
        console.error('Error fetching assistant:', error);
        setError('Failed to load assistant');
        // Redirect to assistants page on error
        router.push('/assistants');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchAssistant();
  }, [id, activeOrganization, router]);

  // If organization changes, redirect back to assistants
  useEffect(() => {
    if (assistant && activeOrganization && assistant.organizationId !== activeOrganization.id) {
      router.push('/assistants');
    }
  }, [activeOrganization, assistant, router]);

  // Indicator config - last item changes based on provider
  const indicatorConfig = {
    common: [
      { name: "Jibu Fixed Cost", color: "bg-green-500" },
      { name: "deepgram", color: "bg-orange-500" },
      { name: "gpt-4o", color: "bg-yellow-500" },
      { name: "Jibu", color: "bg-blue-500" },
    ],
    web: { name: "Web", color: "bg-purple-500" },
    twilio: { name: "Twilio", color: "bg-purple-500" },
    vonage: { name: "Vonage", color: "bg-purple-500" }
  }

  // Debounced save function
  const debouncedSave = useCallback(
    (() => {
      let timeout: NodeJS.Timeout | null = null;
      
      return (data: any) => {
        if (timeout) clearTimeout(timeout);
        
        timeout = setTimeout(async () => {
          setSaving(true);
          try {
            const updated = await updateAssistant(id, data);
            setLastSaved(new Date(updated.updatedAt));
            setIsDirty(false);
          } catch (error) {
            console.error('Error autosaving:', error);
            setError('Failed to autosave');
          } finally {
            setSaving(false);
          }
        }, 1000); // 1 second debounce
      };
    })(),
    [id]
  );

  // Handle field changes with autosave
  const handleFirstMessageChange = (value: string) => {
    setFirstMessage(value);
    setIsDirty(true);
    debouncedSave({ description: value });
  };

  const handleSystemPromptChange = (value: string) => {
    setSystemPrompt(value);
    setIsDirty(true);
    debouncedSave({ systemPrompt: value });
  };

  const handleModelChange = (value: string) => {
    setModel(value);
    setIsDirty(true);
    debouncedSave({ config: { name: value } });
  };

  const handleProviderChange = (value: string) => {
    setProvider(value);
    // Provider doesn't need to be saved to the API in this implementation
  };

  const handleTemperatureChange = (value: number) => {
    setTemperature(value);
    setIsDirty(true);
    debouncedSave({ config: { ...assistant?.model, temperature: value } });
  };

  const handleMaxTokensChange = (value: number) => {
    setMaxTokens(value);
    setIsDirty(true);
    debouncedSave({ config: { ...assistant?.model, maxTokens: value } });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateAssistant(id, {
        name,
        description: firstMessage, // maps to firstMessage in backend
        systemPrompt: systemPrompt, // maps to voicemailMessage in backend
        knowledgeBaseId: knowledgeBaseId, // add knowledge base ID
        config: typeof model === 'string' ? { 
          name: model,
          temperature,
          maxTokens
        } : model // Save model configuration with temperature and maxTokens
      });
      setLastSaved(new Date(updated.updatedAt));
      setIsDirty(false);
      
      // If this is a new assistant, redirect to the new URL
      if (id === 'new' && updated.id) {
        router.push(`/assistants/${updated.id}`);
      }
    } catch (error) {
      console.error('Error saving assistant:', error);
      setError('Failed to save assistant');
    } finally {
      setSaving(false);
    }
  };

  // Format date for display
  const formatDateTime = (date: Date | null) => {
    if (!date) return '';
    return format(date, "MMM d, yyyy h:mm a");
  };

  // Add scroll to section behavior
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-gray-500">Loading assistant...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#f7f7f8]">
      {/* Top Bar */}
      <AssistantHeader 
        assistantName={assistantName}
        assistantId={id}
        selectedProvider={selectedProvider}
        autosaveStatus={
          saving ? (
            <span>Saving...</span>
          ) : lastSaved ? (
            <span>Autosaved on {formatDateTime(lastSaved)}</span>
          ) : (
            <span>Not saved yet</span>
          )
        }
      />

      {/* Main Tabs */}
      <div className="bg-white">
        <Tabs defaultValue="model" className="w-full">
          <TabsList className="w-full justify-start bg-[#f7f7f8]">
            <TabsTrigger 
              value="model" 
              className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-primary/10 data-[state=active]:shadow-none"
              onClick={() => scrollToSection('model-section')}
            >
              Model
            </TabsTrigger>
            <TabsTrigger 
              value="transcriber"
              className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-primary/10 data-[state=active]:shadow-none"
              onClick={() => scrollToSection('transcriber-section')}
            >
              Transcriber
            </TabsTrigger>
            <TabsTrigger 
              value="voice"
              className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-primary/10 data-[state=active]:shadow-none"
              onClick={() => scrollToSection('voice-section')}
            >
              Voice
            </TabsTrigger>
            <TabsTrigger 
              value="tools"
              className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-primary/10 data-[state=active]:shadow-none"
              onClick={() => scrollToSection('tools-section')}
            >
              Tools
            </TabsTrigger>
            <TabsTrigger 
              value="analysis"
              className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-primary/10 data-[state=active]:shadow-none"
              onClick={() => scrollToSection('analysis-section')}
            >
              Analysis
            </TabsTrigger>
            <TabsTrigger 
              value="advanced"
              className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-primary/10 data-[state=active]:shadow-none"
              onClick={() => scrollToSection('advanced-section')}
            >
              Advanced
            </TabsTrigger>
          </TabsList>
          
          {/* Content Area */}
          <div className="flex flex-col p-6 bg-[#f7f7f8]">
            <div className="w-5/6 mx-auto">
              {/* Top Row with API Indicators and Provider Dropdown */}
              <div className="flex justify-between items-center mb-2">
                {/* API Indicators */}
                <div className="flex items-center gap-2 py-2 text-xs">
                  {indicatorConfig.common.map((indicator, index) => (
                    <React.Fragment key={index}>
                      <div className={`w-2 h-2 rounded-full ${indicator.color}`}></div>
                      <span>{indicator.name}</span>
                      <div className="ml-4"></div>
                    </React.Fragment>
                  ))}
                  <div className={`w-2 h-2 rounded-full ${indicatorConfig[selectedProvider].color}`}></div>
                  <span>{indicatorConfig[selectedProvider].name}</span>
                </div>
                
                {/* Provider Dropdown */}
                <div className="flex items-center">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-[120px] rounded-full border focus:ring-0 focus:ring-offset-0 bg-transparent">
                        {selectedProvider}
                        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="ml-2 h-4 w-4">
                          <path d="M4.5 6.5L7.5 9.5L10.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                        </svg>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" sideOffset={4} className="w-full border-0">
                      <DropdownMenuItem onClick={() => setSelectedProvider("web")}>Web</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSelectedProvider("twilio")}>Twilio</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSelectedProvider("vonage")}>Vonage</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              
              {/* Metrics Cards */}
              <div className="flex space-x-6 mb-6">
                {/* Cost Card */}
                <div className="flex-1">
                  <CostCard provider={selectedProvider} />
                </div>

                {/* Latency Card */}
                <div className="flex-1">
                  <LatencyCard provider={selectedProvider} />
                </div>
              </div>
              
              {/* Main Configuration Area */}
              <TabsContent value="model" className="space-y-4">
                <div id="model-section" className="mb-4">
                  <h2 className="text-xl font-bold border-b-2 border-gray-200 pb-2">Model Configuration</h2>
                </div>
                <ModelConfig
                  firstMessage={firstMessage}
                  systemPrompt={systemPrompt}
                  provider={provider}
                  model={model}
                  temperature={temperature}
                  maxTokens={maxTokens}
                  assistantId={id !== 'new' ? id : undefined}
                  knowledgeBaseId={knowledgeBaseId || undefined}
                  organizationId={activeOrganization?.id}
                  onFirstMessageChange={handleFirstMessageChange}
                  onSystemPromptChange={handleSystemPromptChange}
                  onProviderChange={handleProviderChange}
                  onModelChange={handleModelChange}
                  onTemperatureChange={handleTemperatureChange}
                  onMaxTokensChange={handleMaxTokensChange}
                  onKnowledgeBaseChange={setKnowledgeBaseId}
                />
              </TabsContent>
              
              <TabsContent value="transcriber" className="space-y-4">
                <div id="transcriber-section" className="mb-4">
                  <h2 className="text-xl font-bold border-b-2 border-gray-200 pb-2">Transcriber Configuration</h2>
                </div>
                <div className="p-4 bg-white rounded-lg shadow-sm">
                  <p className="text-sm text-muted-foreground">Configure the transcription settings.</p>
                </div>
              </TabsContent>
              
              <TabsContent value="voice" className="space-y-4">
                <div id="voice-section" className="mb-4">
                  <h2 className="text-xl font-bold border-b-2 border-gray-200 pb-2">Voice Configuration</h2>
                </div>
                <div className="p-4 bg-white rounded-lg shadow-sm">
                  <p className="text-sm text-muted-foreground">Configure the voice settings.</p>
                </div>
              </TabsContent>
              
              <TabsContent value="tools" className="space-y-4">
                <div id="tools-section" className="mb-4">
                  <h2 className="text-xl font-bold border-b-2 border-gray-200 pb-2">Tools Configuration</h2>
                </div>
                <div className="p-4 bg-white rounded-lg shadow-sm">
                  <p className="text-sm text-muted-foreground">Configure the available tools.</p>
                </div>
              </TabsContent>
              
              <TabsContent value="analysis" className="space-y-4">
                <div id="analysis-section" className="mb-4">
                  <h2 className="text-xl font-bold border-b-2 border-gray-200 pb-2">Analysis Configuration</h2>
                </div>
                <div className="p-4 bg-white rounded-lg shadow-sm">
                  <p className="text-sm text-muted-foreground">Configure the analysis settings.</p>
                </div>
              </TabsContent>
              
              <TabsContent value="advanced" className="space-y-4">
                <div id="advanced-section" className="mb-4">
                  <h2 className="text-xl font-bold border-b-2 border-gray-200 pb-2">Advanced Configuration</h2>
                </div>
                <div className="p-4 bg-white rounded-lg shadow-sm">
                  <p className="text-sm text-muted-foreground">Configure advanced settings.</p>
                </div>
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </div>
    </div>
  )
} 