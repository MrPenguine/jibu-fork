"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@libs/shadcn-ui/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { getAssistant, updateAssistant } from '../../../../../../../utils/AssistantsApi';
import { ModelConfig } from '@libs/shadcn-ui/components/assistants/ModelConfig';

export default function AssistantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.id as string;
  const assistantId = params.assistantId as string;
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  // Assistant state
  const [firstMessage, setFirstMessage] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [knowledgeBaseId, setKnowledgeBaseId] = useState<string | undefined>(undefined);
  
  useEffect(() => {
    const fetchAssistant = async () => {
      try {
        setIsLoading(true);
        
        // Fetch assistant details
        const assistantData = await getAssistant(assistantId);
        
        // Populate state with assistant data
        setFirstMessage(assistantData.firstMessage || '');
        setSystemPrompt(assistantData.voicemailMessage || '');
        
        // Set model settings
        if (assistantData.model) {
          setProvider(assistantData.model.provider || '');
          setModel(assistantData.model.model || '');
          setTemperature(assistantData.model.temperature || 0.7);
          setMaxTokens(assistantData.model.maxTokens || 2048);
        }
        
        // Set knowledge base ID if available
        setKnowledgeBaseId(assistantData.knowledgeBaseId);
        
        setError(null);
      } catch (err: any) {
        console.error('Error fetching assistant details:', err);
        setError('Failed to load assistant details');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (assistantId && assistantId !== 'new') {
      fetchAssistant();
    } else {
      setIsLoading(false);
    }
  }, [assistantId]);
  
  const handleBackToList = () => {
    router.push(`/agents/${agentId}/cms/assistant`);
  };
  
  // Handlers for model config changes
  const handleFirstMessageChange = (value: string) => setFirstMessage(value);
  const handleSystemPromptChange = (value: string) => setSystemPrompt(value);
  const handleProviderChange = (value: string) => setProvider(value);
  const handleModelChange = (value: string) => setModel(value);
  const handleTemperatureChange = (value: number) => setTemperature(value);
  const handleMaxTokensChange = (value: number) => setMaxTokens(value);
  const handleKnowledgeBaseChange = (value: string | null) => 
    setKnowledgeBaseId(value || undefined);
  
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <h3 className="text-lg font-medium">Loading assistant...</h3>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-6 bg-red-50 rounded-lg m-6">
        <h3 className="text-lg font-medium text-red-800 mb-2">Error</h3>
        <p className="text-red-600">{error}</p>
        <Button className="mt-4" onClick={handleBackToList}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Assistants
        </Button>
      </div>
    );
  }
  
  return (
    <div className="p-6 bg-gray-50 h-full">
      <div className="flex items-center mb-4">
        <Button variant="ghost" onClick={handleBackToList} className="mr-2">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-2xl font-semibold flex-1">Assistant Configuration</h1>
        {lastSaved && (
          <span className="text-sm text-gray-500 mr-4">
            Last saved: {lastSaved.toLocaleTimeString()}
          </span>
        )}
      </div>
      
      <ModelConfig
        firstMessage={firstMessage}
        systemPrompt={systemPrompt}
        provider={provider}
        model={model}
        temperature={temperature}
        maxTokens={maxTokens}
        assistantId={assistantId}
        knowledgeBaseId={knowledgeBaseId}
        onFirstMessageChange={handleFirstMessageChange}
        onSystemPromptChange={handleSystemPromptChange}
        onProviderChange={handleProviderChange}
        onModelChange={handleModelChange}
        onTemperatureChange={handleTemperatureChange}
        onMaxTokensChange={handleMaxTokensChange}
        onKnowledgeBaseChange={handleKnowledgeBaseChange}
      />
    </div>
  );
}