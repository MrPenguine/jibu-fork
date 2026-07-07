"use client";

import React from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../../ui/sheet";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Slider } from "../../ui/slider";
import { Input } from "../../ui/input";
import { Textarea } from "../../ui/textarea";
import { Progress } from "../../ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Badge } from "../../ui/badge";
import { Brain, SlidersHorizontal, TextQuote, FileStack, Sparkles, AlertTriangle, RotateCcw, Loader2, Activity, CheckCircle2, XCircle } from "lucide-react";

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
  onTestModel?: (model: string, ollamaUrl?: string) => Promise<{ available: boolean; error?: string; message?: string }>;
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
  onTestModel,
}: KnowledgeBaseSettingsDialogProps) {
  const [kbName, setKbName] = React.useState(name);
  const [embeddingModel, setEmbeddingModel] = React.useState("gemini-embedding-001");
  const [topK, setTopK] = React.useState<number>(5);
  const [temperature, setTemperature] = React.useState<number>(0.1);
  const [maxTokens, setMaxTokens] = React.useState<number>(500);
  const [systemPrompt, setSystemPrompt] = React.useState("");
  const [chunkSize, setChunkSize] = React.useState<number>(1000);
  const [chunkOverlap, setChunkOverlap] = React.useState<number>(200);
  const [progress, setProgress] = React.useState(0);
  const [testStatus, setTestStatus] = React.useState<{ available: boolean; message?: string; error?: string } | null>(null);
  const [testingModel, setTestingModel] = React.useState(false);
  const [ollamaUrl, setOllamaUrl] = React.useState("");

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

  React.useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (saving) {
      setProgress(0);
      timer = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return prev;
          return prev + (modelChanged ? 2 : 10);
        });
      }, 600);
    } else {
      setProgress(0);
    }
    return () => clearInterval(timer);
  }, [saving, modelChanged]);

  const handleSave = () => {
    const cappedSize = Math.min(chunkSize, maxChunkChars);
    onSave({
      name: kbName.trim() || name,
      embeddingModel,
      retrievalConfig: { topK, systemPrompt, temperature, maxTokens },
      defaultChunkConfig: { chunkSize: cappedSize, chunkOverlap: Math.min(chunkOverlap, cappedSize - 1) },
    });
  };

  const handleTestModel = async () => {
    if (!onTestModel) return;
    setTestingModel(true);
    setTestStatus(null);
    try {
      const result = await onTestModel(embeddingModel, ollamaUrl.trim() || undefined);
      setTestStatus(result);
    } catch (e: any) {
      setTestStatus({ available: false, error: e?.message || 'Failed to run model test' });
    } finally {
      setTestingModel(false);
    }
  };

  const resetToDefault = () => {
    setTopK(5);
    setTemperature(0.1);
    setMaxTokens(500);
    setChunkSize(Math.min(1000, maxChunkChars));
    setChunkOverlap(200);
  };

  const providerColor: Record<string, string> = {
    gemini: "bg-emerald-50 text-emerald-700 border-emerald-100",
    openai: "bg-blue-50 text-blue-700 border-blue-100",
    ollama: "bg-violet-50 text-violet-700 border-violet-100",
  };

  const providerLabel = selectedSpec?.provider || "gemini";
  const providerClasses = providerColor[providerLabel] || providerColor.gemini;

  return (
    <Sheet open={open} onOpenChange={(v) => !saving && onOpenChange(v)} modal={false}>
      <SheetContent side="right" className="w-full sm:max-w-xl lg:max-w-xl max-h-[100vh] overflow-y-auto border-l-0 bg-white p-0 shadow-2xl">
        <SheetHeader className="sticky top-0 z-10 bg-gradient-to-r from-primary to-emerald-600 px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/20 p-2">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div>
              <SheetTitle className="text-lg font-semibold text-white">Knowledge base settings</SheetTitle>
              <SheetDescription className="text-emerald-50">
                Configure the embedding model and retrieval behaviour for this knowledge base.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {loading ? (
          <div className="space-y-4 px-6 py-8">
            <div className="h-9 w-full animate-pulse rounded-xl bg-slate-100" />
            <div className="h-9 w-full animate-pulse rounded-xl bg-slate-100" />
            <div className="h-9 w-full animate-pulse rounded-xl bg-slate-100" />
          </div>
        ) : (
          <div className="space-y-5 px-6 py-5">
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">Knowledge base name</Label>
              <Input
                value={kbName}
                onChange={(e) => setKbName(e.target.value)}
                placeholder="Knowledge base name"
                className="rounded-xl border-slate-200 focus-visible:ring-primary"
              />
            </div>

            <Card className="border-0 shadow-sm bg-slate-50/60 rounded-xl overflow-hidden">
              <CardHeader className="pb-3 pt-4 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-800">
                  <Sparkles className="h-4 w-4 text-violet-500" />
                  Embedding model
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-4">
                <Select value={embeddingModel} onValueChange={handleModelChange} disabled={saving}>
                  <SelectTrigger className="rounded-xl border-slate-200 bg-white focus:ring-primary">
                    <SelectValue placeholder="Select an embedding model" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {models.map((m) => {
                      const isSelectable =
                        m.model === 'qwen3-embedding:0.6b' ||
                        m.model === 'nomic-embed-text-v2-moe';
                      return (
                        <SelectItem
                          key={m.model}
                          value={m.model}
                          disabled={!isSelectable}
                          className="rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{m.model}</span>
                            <Badge variant="outline" className={providerColor[m.provider] || providerColor.gemini}>
                              {m.provider}
                            </Badge>
                            <span className="text-xs text-slate-400">{m.dimension}d</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-3 flex-wrap">
                  <Badge variant="outline" className={providerClasses}>
                    {providerLabel}
                  </Badge>
                  <span className="text-xs text-slate-500">
                    Max input <span className="font-medium text-slate-700">{maxChunkChars.toLocaleString()} chars</span> ·{" "}
                    <span className="font-medium text-slate-700">{selectedSpec?.dimension ?? "?"} dimensions</span>
                  </span>
                  {selectedSpec?.provider === 'ollama' && onTestModel && (
                    <div className="flex items-center gap-2 w-full">
                      <Input
                        value={ollamaUrl}
                        onChange={(e) => setOllamaUrl(e.target.value)}
                        placeholder="http://127.0.0.1:11435 (optional)"
                        className="rounded-xl border-slate-200 h-7 text-xs flex-1"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleTestModel}
                        disabled={testingModel}
                        className="rounded-xl border-slate-200 h-7 gap-1.5 text-xs shrink-0"
                      >
                        {testingModel ? <Loader2 className="h-3 w-3 animate-spin" /> : <Activity className="h-3 w-3" />}
                        Test model
                      </Button>
                    </div>
                  )}
                </div>

                {testStatus && (
                  <div className={`rounded-xl px-4 py-3 text-xs border flex items-start gap-2 ${
                    testStatus.available
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
                      : 'bg-red-50 text-red-800 border-red-100'
                  }`}>
                    {testStatus.available ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    )}
                    <span>{testStatus.available ? testStatus.message : (testStatus.error || 'Model unavailable')}</span>
                  </div>
                )}

                {modelChanged && (
                  <div className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800 border border-amber-100 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      Changing the embedding model will <strong>re-embed every source</strong> in this knowledge base because the vector space differs. This may take a while.
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-slate-50/60 rounded-xl overflow-hidden">
              <CardHeader className="pb-3 pt-4 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-800">
                  <FileStack className="h-4 w-4 text-emerald-500" />
                  Chunking
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-700 text-sm">Default chunk size</Label>
                    <span className="text-xs font-medium text-slate-600 bg-white px-2 py-1 rounded-lg border border-slate-100">
                      {chunkSize.toLocaleString()} chars
                    </span>
                  </div>
                  <Slider
                    min={100}
                    max={maxChunkChars}
                    step={100}
                    value={[Math.min(chunkSize, maxChunkChars)]}
                    onValueChange={(v) => setChunkSize(v[0])}
                    disabled={saving}
                  />
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>100</span>
                    <span>{maxChunkChars.toLocaleString()} (model max)</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-700 text-sm">Chunk overlap</Label>
                    <span className="text-xs font-medium text-slate-600 bg-white px-2 py-1 rounded-lg border border-slate-100">
                      {chunkOverlap} chars
                    </span>
                  </div>
                  <Slider
                    min={0}
                    max={Math.min(4000, Math.floor(maxChunkChars / 2))}
                    step={50}
                    value={[chunkOverlap]}
                    onValueChange={(v) => setChunkOverlap(v[0])}
                    disabled={saving}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-slate-50/60 rounded-xl overflow-hidden">
              <CardHeader className="pb-3 pt-4 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-800">
                  <SlidersHorizontal className="h-4 w-4 text-blue-500" />
                  Retrieval
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-700 text-sm">Chunk limit (top-K)</Label>
                    <span className="text-xs font-medium text-slate-600 bg-white px-2 py-1 rounded-lg border border-slate-100">
                      {topK}
                    </span>
                  </div>
                  <Slider min={1} max={20} step={1} value={[topK]} onValueChange={(v) => setTopK(v[0])} disabled={saving} />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-700 text-sm">Temperature</Label>
                    <span className="text-xs font-medium text-slate-600 bg-white px-2 py-1 rounded-lg border border-slate-100">
                      {temperature.toFixed(2)}
                    </span>
                  </div>
                  <Slider
                    min={0}
                    max={1}
                    step={0.01}
                    value={[temperature]}
                    onValueChange={(v) => setTemperature(v[0])}
                    disabled={saving}
                  />
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Deterministic</span>
                    <span>Random</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-700 text-sm">Max tokens</Label>
                  <Input
                    type="number"
                    min={10}
                    max={8192}
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(Number(e.target.value) || 0)}
                    className="rounded-xl border-slate-200 focus-visible:ring-indigo-500"
                    disabled={saving}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-slate-50/60 rounded-xl overflow-hidden">
              <CardHeader className="pb-3 pt-4 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-800">
                  <TextQuote className="h-4 w-4 text-rose-500" />
                  System prompt
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <Textarea
                  rows={6}
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  className="rounded-xl border-slate-200 focus-visible:ring-indigo-500 resize-none"
                  disabled={saving}
                />
              </CardContent>
            </Card>
          </div>
        )}

        <div className="sticky bottom-0 border-t border-slate-100 bg-white/80 backdrop-blur px-6 py-4">
          {saving && modelChanged && (
            <div className="mb-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                  Re-indexing knowledge base…
                </span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2 rounded-full bg-slate-100" />
              <p className="text-[11px] text-slate-400">Chunking and embedding every source. Keep this panel open.</p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={resetToDefault}
              disabled={loading || saving}
              className="text-slate-500 hover:text-slate-700 gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
                className="rounded-xl border-slate-200"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={loading || saving}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? "Saving…" : "Save settings"}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
