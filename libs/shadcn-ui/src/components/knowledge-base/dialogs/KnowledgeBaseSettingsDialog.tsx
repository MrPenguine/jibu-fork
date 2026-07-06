"use client";

import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Slider } from "../../ui/slider";
import { Input } from "../../ui/input";
import { Textarea } from "../../ui/textarea";
import { Separator } from "../../ui/separator";

export interface EmbeddingModelInfo {
  model: string;
  provider: string;
  dimension: number;
  maxChunkChars: number;
}

export interface KbSettingsValue {
  embeddingProvider: string;
  embeddingModel: string;
  embeddingDimension?: number;
  maxChunkChars?: number;
  retrievalConfig: {
    topK?: number;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
  };
  defaultChunkConfig: {
    strategies?: string[];
    chunkSize?: number;
    chunkOverlap?: number;
  };
  availableModels: EmbeddingModelInfo[];
}

export interface KbSettingsSavePayload {
  name: string;
  embeddingModel: string;
  retrievalConfig: {
    topK: number;
    systemPrompt: string;
    temperature: number;
    maxTokens: number;
  };
  defaultChunkConfig: {
    chunkSize: number;
    chunkOverlap: number;
  };
}

interface KnowledgeBaseSettingsDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  name: string;
  settings: KbSettingsValue | null;
  loading?: boolean;
  saving?: boolean;
  onSave: (payload: KbSettingsSavePayload) => void;
}

const DEFAULT_MAX_CHUNK = 8000;

export function KnowledgeBaseSettingsDialog({
  open,
  onOpenChange,
  name,
  settings,
  loading = false,
  saving = false,
  onSave,
}: KnowledgeBaseSettingsDialogProps) {
  const [kbName, setKbName] = React.useState(name);
  const [embeddingModel, setEmbeddingModel] = React.useState("gemini-embedding-001");
  const [topK, setTopK] = React.useState<number>(5);
  const [temperature, setTemperature] = React.useState<number>(0.1);
  const [maxTokens, setMaxTokens] = React.useState<number>(500);
  const [systemPrompt, setSystemPrompt] = React.useState("");
  const [chunkSize, setChunkSize] = React.useState<number>(1000);
  const [chunkOverlap, setChunkOverlap] = React.useState<number>(200);

  // Hydrate local state whenever the dialog opens with fresh settings.
  React.useEffect(() => {
    if (!open) return;
    setKbName(name);
    if (settings) {
      setEmbeddingModel(settings.embeddingModel || "gemini-embedding-001");
      setTopK(settings.retrievalConfig?.topK ?? 5);
      setTemperature(settings.retrievalConfig?.temperature ?? 0.1);
      setMaxTokens(settings.retrievalConfig?.maxTokens ?? 500);
      setSystemPrompt(settings.retrievalConfig?.systemPrompt ?? "");
      setChunkSize(settings.defaultChunkConfig?.chunkSize ?? 1000);
      setChunkOverlap(settings.defaultChunkConfig?.chunkOverlap ?? 200);
    }
  }, [open, settings, name]);

  const models = settings?.availableModels ?? [];
  const selectedSpec = models.find((m) => m.model === embeddingModel);
  // The chunk-size slider is model-aware: its ceiling is the selected model's
  // safe input window so a chunk can never exceed what the model can embed.
  const maxChunkChars = selectedSpec?.maxChunkChars ?? settings?.maxChunkChars ?? DEFAULT_MAX_CHUNK;
  const modelChanged = !!settings && embeddingModel !== settings.embeddingModel;

  // When the model changes, clamp chunk size + overlap to the new window.
  const handleModelChange = (value: string) => {
    setEmbeddingModel(value);
    const spec = models.find((m) => m.model === value);
    const cap = spec?.maxChunkChars ?? DEFAULT_MAX_CHUNK;
    setChunkSize((cur) => Math.min(cur, cap));
    setChunkOverlap((cur) => Math.min(cur, Math.floor(cap / 2)));
  };

  const handleSave = () => {
    const cappedSize = Math.min(chunkSize, maxChunkChars);
    onSave({
      name: kbName.trim() || name,
      embeddingModel,
      retrievalConfig: { topK, systemPrompt, temperature, maxTokens },
      defaultChunkConfig: { chunkSize: cappedSize, chunkOverlap: Math.min(chunkOverlap, cappedSize - 1) },
    });
  };

  const resetToDefault = () => {
    setTopK(5);
    setTemperature(0.1);
    setMaxTokens(500);
    setChunkSize(Math.min(1000, maxChunkChars));
    setChunkOverlap(200);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Knowledge base settings</DialogTitle>
          <DialogDescription>
            Configure the embedding model and retrieval behaviour for this knowledge base.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4 py-6">
            <div className="h-9 w-full animate-pulse rounded bg-slate-100" />
            <div className="h-9 w-full animate-pulse rounded bg-slate-100" />
            <div className="h-9 w-full animate-pulse rounded bg-slate-100" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-slate-700">Knowledge base name</Label>
              <Input value={kbName} onChange={(e) => setKbName(e.target.value)} placeholder="Knowledge base name" />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-slate-700">Embedding model</Label>
              <Select value={embeddingModel} onValueChange={handleModelChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an embedding model" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m.model} value={m.model}>
                      {m.model} · {m.provider} · {m.dimension}d
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                Max input {maxChunkChars.toLocaleString()} chars · {selectedSpec?.dimension ?? "?"} dimensions
              </p>
              {modelChanged && (
                <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Changing the embedding model re-embeds every source in this knowledge base (its vector space differs). This can take a while.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-slate-700">Default chunk size</Label>
                <span className="text-xs text-slate-500">{chunkSize.toLocaleString()} chars</span>
              </div>
              <Slider
                min={100}
                max={maxChunkChars}
                step={100}
                value={[Math.min(chunkSize, maxChunkChars)]}
                onValueChange={(v) => setChunkSize(v[0])}
              />
              <div className="flex justify-between text-xs text-slate-500">
                <span>100</span>
                <span>{maxChunkChars.toLocaleString()} (model max)</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-slate-700">Chunk overlap</Label>
                <span className="text-xs text-slate-500">{chunkOverlap} chars</span>
              </div>
              <Slider
                min={0}
                max={Math.min(4000, Math.floor(maxChunkChars / 2))}
                step={50}
                value={[chunkOverlap]}
                onValueChange={(v) => setChunkOverlap(v[0])}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-slate-700">Chunk limit (top-K)</Label>
                <span className="text-xs text-slate-500">{topK}</span>
              </div>
              <Slider min={1} max={20} step={1} value={[topK]} onValueChange={(v) => setTopK(v[0])} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-slate-700">Temperature</Label>
                <span className="text-xs text-slate-500">{temperature.toFixed(2)}</span>
              </div>
              <Slider min={0} max={1} step={0.01} value={[temperature]} onValueChange={(v) => setTemperature(v[0])} />
              <div className="flex justify-between text-xs text-slate-500">
                <span>Deterministic</span>
                <span>Random</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-700">Max tokens</Label>
              <Input
                type="number"
                min={10}
                max={8192}
                value={maxTokens}
                onChange={(e) => setMaxTokens(Number(e.target.value) || 0)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-700">System prompt</Label>
              <Textarea rows={6} value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} />
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <Button variant="ghost" onClick={resetToDefault} disabled={loading || saving}>
            Reset to default
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading || saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
