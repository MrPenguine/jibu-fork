"use client";

import React, { useState, useEffect } from 'react';
import { Search, Bot, ArrowUpDown } from 'lucide-react';
import { getAssistants, Assistant } from '../../../../../apps/frontend/src/utils/AssistantsApi';

interface AssistantListProps {
  agentId: string;
  searchQuery: string;
  onSelectAssistant: (assistantId: string) => void;
}

type AssistantType = {
  id: string;
  name: string;
  capabilities: string[];
  status: string;
  updatedAt: string;
  knowledgeBaseId?: string | null;
  model?: {
    provider?: string;
    model?: string;
  };
};

export function AssistantList({ agentId, searchQuery, onSelectAssistant }: AssistantListProps) {
  const [assistants, setAssistants] = useState<AssistantType[]>([]);
  const [selectedAssistants, setSelectedAssistants] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAssistants = async () => {
      setIsLoading(true);
      try {
        // Fetch assistants for this agent
        const fetchedAssistants = await getAssistants(agentId);
        
        // Transform the assistants to include capabilities
        const transformedAssistants: AssistantType[] = fetchedAssistants.map((assistant) => {
          const capabilities: string[] = [];
          
          // Add capabilities based on assistant properties
          capabilities.push('Chat'); // All assistants have chat
          
          if (assistant.knowledgeBaseId) {
            capabilities.push('Knowledge Base');
          }
          
          if (assistant.voice?.voiceId) {
            capabilities.push('Voice');
          }
          
          // Determine status (simple active/inactive for now)
          const status = 'Active'; // You may want to derive this from actual status
          
          return {
            id: assistant.id,
            name: assistant.name,
            capabilities,
            status,
            updatedAt: new Date(assistant.updatedAt).toLocaleString(),
            knowledgeBaseId: assistant.knowledgeBaseId,
            model: assistant.model
          };
        });
        
        setAssistants(transformedAssistants);
        setError(null);
      } catch (err) {
        console.error('Error fetching assistants:', err);
        setError('Failed to load assistants');
        // Fallback to empty array
        setAssistants([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAssistants();
  }, [agentId]);

  // Filter assistants based on search query
  const filteredAssistants = assistants.filter(assistant => 
    assistant.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCheckAllChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;
    if (checked) {
      setSelectedAssistants(filteredAssistants.map(a => a.id));
    } else {
      setSelectedAssistants([]);
    }
  };

  const handleCheckboxChange = (id: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;
    if (checked) {
      setSelectedAssistants([...selectedAssistants, id]);
    } else {
      setSelectedAssistants(selectedAssistants.filter(assistantId => assistantId !== id));
    }
  };

  const renderCapabilityBadges = (capabilities: string[]) => {
    return (
      <div className="flex flex-wrap gap-1">
        {capabilities.map((capability, index) => (
          <span 
            key={index} 
            className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full"
          >
            {capability}
          </span>
        ))}
      </div>
    );
  };

  const getStatusClassName = (status: string) => {
    return status === 'Active' 
      ? "px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800" 
      : "px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800";
  };

  if (isLoading) {
    return <div className="p-8 text-center">Loading assistants...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-500">{error}</div>;
  }

  if (filteredAssistants.length === 0) {
    return <div className="p-8 text-center">No assistants found. Create a new assistant to get started.</div>;
  }

  return (
    <div className="relative overflow-x-auto">
      <table className="w-full text-left">
        <thead className="bg-gray-50 text-gray-700 text-sm font-medium">
          <tr>
            <th className="p-4 w-12">
              <input 
                type="checkbox" 
                className="h-4 w-4"
                checked={selectedAssistants.length === filteredAssistants.length && filteredAssistants.length > 0}
                onChange={handleCheckAllChange}
              />
            </th>
            <th className="p-4">
              <div className="flex items-center cursor-pointer">
                Name <ArrowUpDown className="ml-2 h-3 w-3" />
              </div>
            </th>
            <th className="p-4">Capabilities</th>
            <th className="p-4">Status</th>
            <th className="p-4">Model</th>
            <th className="p-4">Last Updated</th>
          </tr>
        </thead>
        <tbody>
          {filteredAssistants.map((assistant) => (
            <tr 
              key={assistant.id}
              className="border-b cursor-pointer hover:bg-gray-50"
              onClick={() => onSelectAssistant(assistant.id)}
            >
              <td className="p-4" onClick={(e) => e.stopPropagation()}>
                <input 
                  type="checkbox" 
                  className="h-4 w-4"
                  checked={selectedAssistants.includes(assistant.id)}
                  onChange={(e) => handleCheckboxChange(assistant.id, e)}
                />
              </td>
              <td className="p-4 flex items-center">
                <Bot className="mr-2 h-4 w-4 text-blue-600" />
                <span className="font-medium">{assistant.name}</span>
              </td>
              <td className="p-4">{renderCapabilityBadges(assistant.capabilities)}</td>
              <td className="p-4">
                <span className={getStatusClassName(assistant.status)}>
                  {assistant.status}
                </span>
              </td>
              <td className="p-4">{assistant.model?.provider || '—'} {assistant.model?.model || '—'}</td>
              <td className="p-4">{assistant.updatedAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
