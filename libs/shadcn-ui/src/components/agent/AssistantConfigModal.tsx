"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '../ui/dialog';
import { AssistantNodeData } from './nodes/AssistantNode';
import { ModelConfig } from '../assistants/ModelConfig';

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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full max-w-[900px] h-[80vh] p-0 overflow-hidden border border-gray-200 rounded-xl">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>Block settings</DialogTitle>
          <DialogClose onClick={onClose} className="absolute right-4 top-4" />
        </DialogHeader>
        
        <div className="p-6 h-[calc(100%-4rem)] overflow-y-auto">
          <ModelConfig
            assistantId={assistantData.apiAssistantId}
            organizationId={assistantData.organizationId || ''}
            systemPrompt={assistantData.systemMessage || ''}
            firstMessage={assistantData.firstMessage || ''}
            provider={assistantData.model?.provider || 'openai'}
            model={assistantData.model?.model || 'gpt-4-turbo'}
            temperature={assistantData.model?.temperature === undefined ? 0.7 : assistantData.model.temperature}
            maxTokens={assistantData.model?.maxTokens === undefined ? 2048 : assistantData.model.maxTokens}
            modelPreference={assistantData.model?.preference || 'balance'}
            knowledgeBaseId={assistantData.knowledgeBaseId === null ? undefined : assistantData.knowledgeBaseId}
            // Pass handlers to update node data when ModelConfig fields change
            onSystemPromptChange={(value) => handleModelConfigChange('systemMessage', value)}
            onFirstMessageChange={(value) => handleModelConfigChange('firstMessage', value)}
            onProviderChange={(value) => handleModelConfigChange('model', { provider: value })}
            onModelChange={(value) => handleModelConfigChange('model', { model: value })}
            onTemperatureChange={(value) => handleModelConfigChange('model', { temperature: value })}
            onMaxTokensChange={(value) => handleModelConfigChange('model', { maxTokens: value })}
            onModelPreferenceChange={(value) => handleModelConfigChange('model', { preference: value })}
            onKnowledgeBaseChange={(value) => handleModelConfigChange('knowledgeBaseId', value)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
