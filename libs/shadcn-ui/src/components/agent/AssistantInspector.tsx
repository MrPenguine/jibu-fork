"use client";

import React, { useState, useEffect } from 'react';
import { ChevronDown, Pencil } from 'lucide-react';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { AssistantNodeData } from './nodes/AssistantNode';
import { FlowNode } from '../../../src/types';
import CreateAssistantModal from './CreateAssistantModal';
import { listAssistantsByAgent, createAssistantMinimal, getAssistantById } from '../../../../../apps/frontend/src/utils/assistants-min';

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
  const [assistants, setAssistants] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [agentId, setAgentId] = useState<string | null>(null);
  
  // Update local data when node changes
  useEffect(() => {
    setLocalData((node.data as AssistantNodeData) || {});
  }, [node]);

  // Extract agentId from URL path as fallback (e.g., /agent/{agentId}/...)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const match = window.location.pathname.match(/\/agent\/([^\/]+)/);
      setAgentId(match ? match[1] : null);
    }
  }, []);

  // Load assistants for this agent
  useEffect(() => {
    const load = async () => {
      if (!agentId) return;
      try {
        setLoading(true);
        const items = await listAssistantsByAgent(agentId);
        setAssistants(items);
      } catch (e) {
        console.error('[AssistantInspector] Failed to load assistants', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [agentId]);

  // Ensure the dropdown shows the currently selected assistant name if only the ID exists
  useEffect(() => {
    const ensureName = async () => {
      const id = (localData as any)?.apiAssistantId;
      if (!id) return;
      // If we already have a name, nothing to do
      if ((localData as any)?.name) return;
      // Try to find it in the loaded list first
      const fromList = assistants.find((a) => a.id === id);
      if (fromList) {
        setLocalData((prev) => ({ ...prev, name: fromList.name }));
        onUpdate(node.id, { name: fromList.name } as Partial<AssistantNodeData>);
        return;
      }
      // Fallback: fetch it by id
      try {
        const details = await getAssistantById(id);
        if (details?.name) {
          setLocalData((prev) => ({ ...prev, name: details.name }));
          onUpdate(node.id, { name: details.name } as Partial<AssistantNodeData>);
        }
      } catch (e) {
        console.warn('[AssistantInspector] Failed to fetch assistant by id', e);
      }
    };
    ensureName();
  }, [localData?.apiAssistantId, assistants, node.id, onUpdate]);

  // When the assistants list arrives later, ensure we sync the name from the list
  useEffect(() => {
    const id = (localData as any)?.apiAssistantId;
    if (!id || !assistants.length) return;
    const fromList = assistants.find((a) => a.id === id);
    if (fromList && localData.name !== fromList.name) {
      setLocalData((prev) => ({ ...prev, name: fromList.name }));
      onUpdate(node.id, { name: fromList.name } as Partial<AssistantNodeData>);
    }
  }, [assistants, localData?.apiAssistantId, localData?.name, node.id, onUpdate]);

  // Handle input changes
  const handleChange = (key: string, value: any) => {
    setLocalData((prev) => ({
      ...prev,
      [key]: value,
    }));
    // Only send the changed field to avoid overwriting with stale localData
    onUpdate(node.id, { [key]: value } as Partial<AssistantNodeData>);
  };

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
            <span>
              {localData.name || assistants.find(a => a.id === localData.apiAssistantId)?.name || (loading ? 'Loading assistants...' : 'Select an assistant')}
            </span>
          </div>
          <ChevronDown className="h-4 w-4" />
        </div>
        
        {isDropdownOpen && (
          <div className="absolute w-full mt-1 bg-white border rounded-md shadow-lg z-10">
            {assistants.map((assistant) => (
              <div 
                key={assistant.id}
                className="p-2 hover:bg-gray-100 cursor-pointer"
                onClick={() => {
                  // Update both fields atomically to prevent race conditions
                  setLocalData((prev) => ({
                    ...prev,
                    apiAssistantId: assistant.id,
                    name: assistant.name,
                  }));
                  onUpdate(node.id, { apiAssistantId: assistant.id, name: assistant.name });
                  setIsDropdownOpen(false);
                }}
              >
                {assistant.name}
              </div>
            ))}
            <div 
              className="p-2 hover:bg-gray-100 cursor-pointer border-t text-blue-600"
              onClick={() => {
                setIsDropdownOpen(false);
                setShowCreate(true);
              }}
            >
              + Create assistant
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

      {/* Create Assistant Modal */}
      <CreateAssistantModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        agentId={agentId || ''}
        create={async (name, aId) => createAssistantMinimal(name, aId)}
        onCreated={(created) => {
          // Refresh list
          setAssistants((prev) => [{ id: created.id, name: created.name }, ...prev]);
          // Select it atomically
          setLocalData((prev) => ({ ...prev, apiAssistantId: created.id, name: created.name }));
          onUpdate(node.id, { apiAssistantId: created.id, name: created.name });
        }}
      />
    </div>
  );
};

export default AssistantInspector;
