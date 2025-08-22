"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@libs/shadcn-ui/components/ui/button';
import { Plus, Loader2 } from 'lucide-react';
import { Assistant, getAssistants, createAssistant } from '../../../../../../utils/AssistantsApi';
import { CreateAssistantModal } from '@libs/shadcn-ui/components/assistants/CreateAssistantModal';

export default function AssistantPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.id as string;
  
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  useEffect(() => {
    const fetchAssistants = async () => {
      try {
        setLoading(true);
        console.log(`[AgentAssistantsPage] Fetching assistants for agent: ${agentId}`);
        
        // For now, we're showing all assistants from the organization that could be linked to this agent
        // In a real implementation, you would need a backend endpoint that returns assistants for a specific agent
        // or modify the Assistant interface to include agentId
        const data = await getAssistants();
        console.log(`[AgentAssistantsPage] Successfully loaded ${data.length} assistants`);
        
        setAssistants(data);
        setError(null);
      } catch (err: any) {
        console.error("[AgentAssistantsPage] Error fetching assistants:", err);
        
        // Handle error cases
        if (err.message && (
          err.message.includes('404') || 
          err.message.includes('not found') ||
          err.message.toLowerCase().includes('no assistants')
        )) {
          // This is normal for a new agent - treat as empty
          setAssistants([]);
          setError(null);
        } else {
          // Generic error for other cases
          setError("Failed to load assistants. Please try again.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchAssistants();
  }, [agentId]);
  
  // Handler for creating a new assistant
  const handleCreateAssistant = () => {
    setIsCreateModalOpen(true);
  };
  
  // Handler for when an assistant is created via the modal
  const handleAssistantCreated = async (name: string, templateId: string) => {
    try {
      setLoading(true);
      // Refresh the assistants list after creation
      const data = await getAssistants();
      setAssistants(data);
      setError(null);
    } catch (error) {
      console.error("Error refreshing assistants:", error);
    } finally {
      setLoading(false);
    }
  };
  
  // Show loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-180px)]">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <h3 className="text-lg font-medium">Loading assistants...</h3>
      </div>
    );
  }
  
  // Show error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-180px)]">
        <div className="bg-red-50 p-6 rounded-xl text-center max-w-md">
          <h3 className="text-lg font-medium text-red-800 mb-2">Something went wrong</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <Button 
            onClick={() => window.location.reload()}
            className="rounded-xl"
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }
  
  // Show empty state if no assistants
  if (assistants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-180px)]">
        <div className="bg-gray-50 dark:bg-gray-900 p-10 rounded-xl text-center max-w-md">
          <div className="bg-primary/10 p-4 rounded-full inline-flex mx-auto mb-4">
            <Plus className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-xl font-medium mb-2">No assistants for this agent</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Create your first assistant for this agent to enhance its capabilities.
          </p>
          <Button 
            onClick={handleCreateAssistant}
            className="rounded-xl flex items-center gap-2"
            size="lg"
          >
            <Plus className="h-4 w-4" /> Create Assistant
          </Button>
        </div>
      </div>
    );
  }
  
  // Show list of assistants
  return (
    <div className="p-6 bg-gray-50 h-full relative">
      {/* Backdrop blur when modal is open */}
      {isCreateModalOpen && (
        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm z-40" />
      )}
      
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold">Assistants</h1>
        <Button onClick={handleCreateAssistant}>
          <Plus className="mr-2 h-4 w-4" />
          New Assistant
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {assistants.map((assistant) => (
          <div 
            key={assistant.id}
            onClick={() => router.push(`/agents/${agentId}/cms/assistant/${assistant.id}`)}
            className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer hover:shadow-md transition-shadow"
          >
            <h3 className="font-medium text-lg mb-2">{assistant.name}</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-4 line-clamp-2">
              {assistant.firstMessage || "No description provided"}
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              {assistant.model && (
                <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                  {assistant.model.provider}/{assistant.model.model}
                </span>
              )}
              {assistant.voice && (
                <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-800">
                  Voice Enabled
                </span>
              )}
              {assistant.knowledgeBaseId && (
                <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800">
                  Knowledge Base
                </span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">
                Created {new Date(assistant.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
      </div>
      
      <CreateAssistantModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreateAssistant={handleAssistantCreated}
      />
    </div>
  );
}
