"use client";

import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';

interface ModelOption {
  provider: string;
  id: string;      // canonical model id (e.g., 'gpt-4o', 'o1-mini', 'grok-3')
  label: string;   // display label, provider-prefixed (e.g., 'openai-o1 mini', 'xai-grok-3')
  icon: string;    // 'claude' | 'google' | 'openai' | 'xai' | 'other'
}

export interface PromptSettingsPanelProps {
  className?: string;
  currentModel?: {
    provider?: string;
    model?: string;
  };
  onModelSelect: (model: { provider: string; model: string }) => void;
  onClose?: () => void;
  showHeader?: boolean;
}

export const PromptSettingsPanel: React.FC<PromptSettingsPanelProps> = ({
  className,
  currentModel,
  onModelSelect,
  onClose,
  showHeader = true,
}) => {
  // Local UI state for sliders
  const [temperature, setTemperature] = useState<number>(0.3);
  const [maxTokens, setMaxTokens] = useState<number>(500);
  const modelOptions: Record<string, ModelOption[]> = {
    anthropic: [
      { provider: 'anthropic', id: 'claude-3.5-sonnet', label: 'anthropic-claude-3.5-sonnet', icon: 'claude' },
      { provider: 'anthropic', id: 'claude-3.5-haiku', label: 'anthropic-claude-3.5-haiku', icon: 'claude' },
      { provider: 'anthropic', id: 'claude-3-opus', label: 'anthropic-claude-3-opus', icon: 'claude' },
      { provider: 'anthropic', id: 'claude-3.7-sonnet', label: 'anthropic-claude-3.7-sonnet', icon: 'claude' },
      { provider: 'anthropic', id: 'claude-4-sonnet', label: 'anthropic-claude-4-sonnet', icon: 'claude' },
      { provider: 'anthropic', id: 'claude-4-opus', label: 'anthropic-claude-4-opus', icon: 'claude' },
    ],
    google: [
      { provider: 'google', id: 'gemini-2.0-flash', label: 'google-gemini-2.0-flash', icon: 'google' },
      { provider: 'google', id: 'gemini-2.5-pro', label: 'google-gemini-2.5-pro', icon: 'google' },
      { provider: 'google', id: 'gemini-2.5-flash', label: 'google-gemini-2.5-flash', icon: 'google' },
    ],
    openai: [
      { provider: 'openai', id: 'gpt-3.5-turbo', label: 'openai-gpt-3.5 turbo', icon: 'openai' },
      { provider: 'openai', id: 'gpt-4-turbo', label: 'openai-gpt-4 turbo', icon: 'openai' },
      { provider: 'openai', id: 'gpt-4', label: 'openai-gpt-4', icon: 'openai' },
      { provider: 'openai', id: 'gpt-4o', label: 'openai-gpt-4o', icon: 'openai' },
      { provider: 'openai', id: 'gpt-4o-mini', label: 'openai-gpt-4o mini', icon: 'openai' },
      { provider: 'openai', id: 'o1', label: 'openai-o1', icon: 'openai' },
      { provider: 'openai', id: 'o1-mini', label: 'openai-o1 mini', icon: 'openai' },
    ],
    xai: [
      { provider: 'xai', id: 'grok-3', label: 'xai-grok-3', icon: 'xai' },
      { provider: 'xai', id: 'grok-3-mini', label: 'xai-grok-3 mini', icon: 'xai' },
      { provider: 'xai', id: 'grok-2', label: 'xai-grok-2', icon: 'xai' },
    ],
    other: [
      { provider: 'deepseek', id: 'r1-distill-llama-70b', label: 'deepseek-r1 distill llama 70b', icon: 'other' },
      { provider: 'meta', id: 'llama-3.1-instant', label: 'meta-llama 3.1 instant', icon: 'other' },
    ],
  };
  const allModels = useMemo(() => {
    const items: { value: string; label: string }[] = [];
    Object.values(modelOptions).forEach(group => {
      group.forEach(m => items.push({ value: `${m.provider}::${m.id}`, label: m.label }));
    });
    return items;
  }, []);

  return (
    <div className={"flex flex-col h-full bg-white " + (className || '')}>
      {/* Header */}
      {showHeader && (
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-sm font-medium">Prompt settings</h3>
          {onClose && (
            <button onClick={onClose} className="rounded-full p-1 hover:bg-slate-100 transition-colors" aria-label="Close panel">
              <X className="h-5 w-5 text-slate-500" />
            </button>
          )}
        </div>
      )}

      {/* Model dropdown */}
      <div className="p-4 border-b">
        <label className="block text-xs text-slate-500 mb-1">AI model</label>
        <Select
          value={currentModel?.provider && currentModel?.model ? `${currentModel.provider}::${currentModel.model}` : undefined}
          onValueChange={(v) => {
            const [provider, model] = v.split('::');
            onModelSelect({ provider, model });
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a model" />
          </SelectTrigger>
          <SelectContent>
            {allModels.map((m) => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Temperature and Max tokens controls */}
      <div className="p-4 border-t">
        <div className="mb-4">
          <div className="flex justify-between mb-2">
            <label className="text-sm font-medium">Temperature</label>
            <span className="text-sm">{temperature.toFixed(1)}</span>
          </div>
          <div className="relative">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Deterministic</span>
              <span>Random</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-2">
            <label className="text-sm font-medium">Max tokens</label>
            <span className="text-sm">{maxTokens}</span>
          </div>
          <div className="relative">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>10</span>
              <span>24000</span>
            </div>
            <input
              type="range"
              min="10"
              max="24000"
              step="10"
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value, 10))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromptSettingsPanel;
