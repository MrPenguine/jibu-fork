"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  getAgentConfig,
  updateAgentConfig,
  listAgentTools,
  getOllamaModels,
  type AgentConfig,
  type WorkspaceTool,
} from "../../../../../utils/agentConfigApi";
import { listKnowledgeBases, type KnowledgeBase } from "../../../../../utils/knowledgebaseApi";
import { Button } from "@libs/shadcn-ui/components/ui/button";
import { Input } from "@libs/shadcn-ui/components/ui/input";
import { Textarea } from "@libs/shadcn-ui/components/ui/textarea";
import { Label } from "@libs/shadcn-ui/components/ui/label";
import { Switch } from "@libs/shadcn-ui/components/ui/switch";
import { Skeleton } from "@libs/shadcn-ui/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@libs/shadcn-ui/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@libs/shadcn-ui/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@libs/shadcn-ui/components/ui/tabs";
import Link from "next/link";
import { toast } from "@libs/shadcn-ui/components/ui/use-toast";
import { Bot, Save, Sliders, Database, Cpu, Wrench, Radio, ExternalLink, Volume2, Loader2, RefreshCw } from "lucide-react";

const PROVIDERS = [
  { value: "google", label: "Google (Gemini)" },
  { value: "xai", label: "xAI (Grok)" },
  { value: "mistral", label: "Mistral" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "ollama", label: "Ollama (Local LLM)" },
];

interface ModelOption {
  value: string;
  label: string;
  description: string;
  badge: "Stable" | "Preview" | "Free" | "Fast";
}

const MODELS: Record<string, ModelOption[]> = {
  google: [
    // Gemini 3 series
    { value: "gemini-3.5-flash", label: "Gemini 3.5 Flash", description: "Best frontier agentic & coding performance", badge: "Stable" },
    { value: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite", description: "Fast & cost-efficient for high-volume tasks", badge: "Stable" },
    { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", description: "Advanced reasoning, complex problem-solving", badge: "Preview" },
    { value: "gemini-3-flash-preview", label: "Gemini 3 Flash", description: "Frontier-class performance at a fraction of cost", badge: "Preview" },
    // Gemini 2.5 series
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash", description: "Best price-performance with deep reasoning", badge: "Stable" },
    { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite", description: "Fastest & most budget-friendly multimodal model", badge: "Stable" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro", description: "Most advanced — deep reasoning & coding", badge: "Stable" },
  ],
  xai: [
    { value: "grok-3-latest", label: "Grok 3", description: "xAI flagship — most capable reasoning model", badge: "Stable" },
    { value: "grok-3-mini-latest", label: "Grok 3 Mini", description: "Faster, lighter Grok 3 for everyday tasks", badge: "Fast" },
    { value: "grok-2-latest", label: "Grok 2", description: "Previous-gen xAI model, reliable & fast", badge: "Stable" },
  ],
  mistral: [
    { value: "mistral-large-latest", label: "Mistral Large", description: "Top-tier reasoning and instruction following", badge: "Stable" },
    { value: "mistral-medium-latest", label: "Mistral Medium", description: "Balanced performance and cost", badge: "Stable" },
    { value: "mistral-small-latest", label: "Mistral Small", description: "Lightweight, fast for simple tasks", badge: "Fast" },
    { value: "open-mistral-nemo", label: "Mistral Nemo", description: "Open-weight, multilingual 12B model", badge: "Free" },
  ],
  ollama: [
    { value: "llama3", label: "Llama 3 (8B)", description: "Meta's flagship local model, great all-rounder", badge: "Free" },
    { value: "mistral", label: "Mistral (7B)", description: "High-quality compact model from Mistral AI", badge: "Free" },
    { value: "gemma2", label: "Gemma 2 (9B)", description: "Google's powerful lightweight open weights", badge: "Free" },
    { value: "phi3", label: "Phi 3 (3.8B)", description: "Microsoft's state-of-the-art small language model", badge: "Free" },
  ],
};

interface OpenRouterModel {
  value: string;
  label: string;
  provider: string;
  description: string;
  badge: "Free" | "Fast" | "Smart" | "Balanced";
  inputPrice: string;   // per 1M input tokens
  outputPrice: string;  // per 1M output tokens
}

const OPENROUTER_MODELS: OpenRouterModel[] = [
  // OpenAI
  { value: "openai/gpt-4o", label: "GPT-4o", provider: "OpenAI", description: "Flagship multimodal — vision, reasoning, tools", badge: "Smart", inputPrice: "$2.50", outputPrice: "$10.00" },
  { value: "openai/gpt-4o-mini", label: "GPT-4o Mini", provider: "OpenAI", description: "Fast and affordable GPT-4 class model", badge: "Fast", inputPrice: "$0.15", outputPrice: "$0.60" },
  { value: "openai/o4-mini", label: "o4-mini", provider: "OpenAI", description: "Compact reasoning model for efficient thinking", badge: "Fast", inputPrice: "$1.10", outputPrice: "$4.40" },
  // Anthropic
  { value: "anthropic/claude-sonnet-4-5", label: "Claude Sonnet 4.5", provider: "Anthropic", description: "Best balance of intelligence and speed", badge: "Smart", inputPrice: "$3.00", outputPrice: "$15.00" },
  { value: "anthropic/claude-3.5-haiku", label: "Claude 3.5 Haiku", provider: "Anthropic", description: "Fastest Claude model for lightweight tasks", badge: "Fast", inputPrice: "$0.80", outputPrice: "$4.00" },
  // Google
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "Google", description: "Best price-performance with reasoning", badge: "Balanced", inputPrice: "$0.15", outputPrice: "$0.60" },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "Google", description: "Most advanced Gemini model", badge: "Smart", inputPrice: "$1.25", outputPrice: "$10.00" },
  { value: "google/gemini-3.5-flash", label: "Gemini 3.5 Flash", provider: "Google", description: "Latest frontier agentic model", badge: "Smart", inputPrice: "$0.30", outputPrice: "$2.50" },
  // Meta
  { value: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B", provider: "Meta", description: "Open-weight 70B, great instruction following", badge: "Balanced", inputPrice: "$0.12", outputPrice: "$0.30" },
  { value: "meta-llama/llama-3.1-8b-instruct:free", label: "Llama 3.1 8B", provider: "Meta", description: "Free tier 8B model for prototyping", badge: "Free", inputPrice: "Free", outputPrice: "Free" },
  // Mistral
  { value: "mistralai/mistral-large", label: "Mistral Large", provider: "Mistral", description: "Top-tier reasoning and instruction following", badge: "Smart", inputPrice: "$2.00", outputPrice: "$6.00" },
  { value: "mistralai/mistral-nemo", label: "Mistral Nemo", provider: "Mistral", description: "Open-weight 12B, multilingual", badge: "Balanced", inputPrice: "$0.13", outputPrice: "$0.13" },
  // DeepSeek
  { value: "deepseek/deepseek-chat", label: "DeepSeek Chat", provider: "DeepSeek", description: "State-of-the-art Chinese open-source LLM", badge: "Balanced", inputPrice: "$0.07", outputPrice: "$1.10" },
  { value: "deepseek/deepseek-r1:free", label: "DeepSeek R1", provider: "DeepSeek", description: "Reasoning model — free tier available", badge: "Free", inputPrice: "Free", outputPrice: "Free" },
  // xAI
  { value: "x-ai/grok-3-mini-beta", label: "Grok 3 Mini", provider: "xAI", description: "Compact xAI reasoning model via OpenRouter", badge: "Fast", inputPrice: "$0.30", outputPrice: "$0.50" },
];


const BADGE_COLORS: Record<string, string> = {
  Stable:   "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Preview:  "bg-amber-50 text-amber-700 border border-amber-200",
  Free:     "bg-blue-50 text-blue-700 border border-blue-200",
  Fast:     "bg-purple-50 text-purple-700 border border-purple-200",
  Smart:    "bg-indigo-50 text-indigo-700 border border-indigo-200",
  Balanced: "bg-slate-50 text-slate-600 border border-slate-200",
};

interface AudioProvider {
  value: string;
  label: string;
  description: string;
  free: string | null;   // free tier description, null = paid only
  quality: 1 | 2 | 3 | 4 | 5;
  badge: "Free" | "Paid" | "Best";
}

const TTS_OPTIONS: AudioProvider[] = [
  { value: "DEEPGRAM",   label: "Deepgram Aura",   description: "Ultra-low-latency streaming TTS, great for real-time voice agents", free: "12K chars/month",  quality: 3, badge: "Free" },
  { value: "GOOGLE",     label: "Google Cloud TTS", description: "Natural voices incl. Chirp HD; wide language support",             free: "1M chars/month",  quality: 4, badge: "Free" },
  { value: "CARTESIA",   label: "Cartesia Sonic-2", description: "Best real-time quality, ultra-low latency, expressive voices",     free: "1M chars/month",  quality: 5, badge: "Best" },
  { value: "AZURE",      label: "Azure Neural TTS", description: "Microsoft neural voices, 400+ voices, 140+ languages",             free: "500K chars/month", quality: 4, badge: "Free" },
  { value: "OPENAI",     label: "OpenAI TTS",       description: "High-quality alloy/nova/echo voices via OpenAI API",               free: null,              quality: 4, badge: "Paid" },
  { value: "ELEVENLABS", label: "ElevenLabs",       description: "Studio-quality voices with emotion & cloning support",             free: "10K chars/month", quality: 5, badge: "Free" },
];

const STT_OPTIONS: AudioProvider[] = [
  { value: "DEEPGRAM",  label: "Deepgram Nova-3",   description: "Fastest real-time STT, best for voice agents, 98% accuracy",  free: "12K mins/year",  quality: 5, badge: "Best" },
  { value: "GOOGLE",    label: "Google Cloud STT",  description: "60+ languages, speaker diarization, high accuracy",            free: "60 mins/month",  quality: 4, badge: "Free" },
  { value: "AZURE",     label: "Azure Speech STT",  description: "Microsoft real-time speech recognition, custom models",         free: "5 hrs/month",    quality: 4, badge: "Free" },
  { value: "WHISPER",   label: "Whisper (OpenAI)",  description: "Open-source multilingual transcription model",                 free: null,              quality: 4, badge: "Paid" },
];

const AUDIO_BADGE_COLORS: Record<string, string> = {
  Free: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Paid: "bg-slate-100 text-slate-600 border border-slate-200",
  Best: "bg-indigo-50 text-indigo-700 border border-indigo-200",
};

const TTS_PROVIDERS = TTS_OPTIONS.map((o) => o.value);
const STT_PROVIDERS = STT_OPTIONS.map((o) => o.value);

export default function AgentConfigPage() {
  const params = useParams();
  const agentId = params.agentId as string;

  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [tools, setTools] = useState<WorkspaceTool[]>([]);
  const [kbs, setKbs] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customModelId, setCustomModelId] = useState("");
  const [localOllamaModels, setLocalOllamaModels] = useState<ModelOption[]>([]);
  const [loadingOllama, setLoadingOllama] = useState(false);

  const fetchLocalOllama = async (silent = false) => {
    try {
      setLoadingOllama(true);
      const list = await getOllamaModels();
      if (list && list.length > 0) {
        setLocalOllamaModels(
          list.map((name) => ({
            value: name,
            label: name,
            description: `Local model tag`,
            badge: "Free" as const,
          }))
        );
        if (!silent) {
          toast({ title: "Scan complete", description: `Detected ${list.length} downloaded Ollama models` });
        }
      } else {
        if (!silent) {
          toast({
            title: "Ollama online, but no models found",
            description: "Run 'ollama pull <model>' to download a model first.",
          });
        }
      }
    } catch (e) {
      if (!silent) {
        toast({ title: "Ollama scan failed", description: "Make sure Ollama daemon is running locally on port 11434.", variant: "destructive" });
      }
    } finally {
      setLoadingOllama(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [cfg, toolList, kbList] = await Promise.all([
          getAgentConfig(agentId),
          listAgentTools(agentId).catch(() => []),
          listKnowledgeBases().catch(() => []),
        ]);
        setConfig(cfg);
        setTools(toolList);
        setKbs(kbList);
        if (cfg.provider === "ollama") {
          // Prefetch local models silently on mount if Ollama is selected
          getOllamaModels().then((list) => {
            if (list && list.length > 0) {
              setLocalOllamaModels(
                list.map((name) => ({
                  value: name,
                  label: name,
                  description: `Local model tag`,
                  badge: "Free" as const,
                }))
              );
            }
          }).catch(() => {});
        }
      } catch (e) {
        toast({ title: "Failed to load agent config", description: String(e), variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    if (agentId) load();
  }, [agentId]);

  // Scan local models automatically when provider is switched to Ollama
  useEffect(() => {
    if (config?.provider === "ollama") {
      fetchLocalOllama(true);
    }
  }, [config?.provider]);

  const update = <K extends keyof AgentConfig>(key: K, value: AgentConfig[K]) => {
    setConfig((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const changeProvider = (provider: string) => {
    const defaultModel = provider === "openrouter" ? "" : MODELS[provider]?.[0]?.value ?? "";
    setConfig((prev) => (prev ? { ...prev, provider, model: defaultModel } : prev));
  };

  const toggleInArray = (key: "toolIds" | "knowledgeBaseIds", id: string) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const set = new Set(prev[key]);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...prev, [key]: Array.from(set) };
    });
  };

  const handleSave = async () => {
    if (!config) return;
    try {
      setSaving(true);
      const saved = await updateAgentConfig(agentId, config);
      setConfig(saved);
      toast({ title: "Agent configuration saved" });
    } catch (e) {
      toast({ title: "Failed to save", description: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !config) {
    return (
      <div className="max-w-6xl mx-auto p-8 space-y-6">
        <Skeleton className="h-12 w-1/3 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-44 w-full rounded-2xl" />
            <Skeleton className="h-96 w-full rounded-2xl" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-48 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  const modelOptions = MODELS[config.provider] || [];

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-8 bg-[#F8FAFC] min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E6F7F0] text-[#009959]">
            <Sliders className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Configure Agent</h1>
            <p className="text-xs text-gray-500">Customize prompt instructions, AI models, knowledge, and tools.</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="bg-[#009959] hover:bg-[#007d49] text-white rounded-xl shadow-sm px-5 py-5 gap-2 transition-all">
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <Tabs defaultValue="general" className="w-full space-y-6">
        <TabsList className="bg-gray-100 p-1 rounded-xl flex gap-1 w-full max-w-md">
          <TabsTrigger value="general" className="rounded-lg text-xs font-semibold px-4 py-2 flex-1">
            General & Brain
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="rounded-lg text-xs font-semibold px-4 py-2 flex-1">
            Knowledge Bases
          </TabsTrigger>
          <TabsTrigger value="tools" className="rounded-lg text-xs font-semibold px-4 py-2 flex-1">
            Tools
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: General & Brain settings */}
        <TabsContent value="general" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2 space-y-8">
              <Card className="shadow-sm border border-gray-200/60 rounded-2xl bg-white">
                <CardHeader className="border-b border-gray-100 pb-4">
                  <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
                    <Bot className="h-5 w-5 text-[#009959]" /> Basics
                  </CardTitle>
                  <CardDescription>Identity parameters for this agent.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-5">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-xs font-semibold text-gray-600">Agent Name</Label>
                    <Input id="name" value={config.name} onChange={(e) => update("name", e.target.value)} className="rounded-xl border-gray-200 focus:border-[#009959] focus:ring-[#009959]/20" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-xs font-semibold text-gray-600">Description</Label>
                    <Input id="description" value={config.description} onChange={(e) => update("description", e.target.value)} className="rounded-xl border-gray-200 focus:border-[#009959] focus:ring-[#009959]/20" />
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm border border-gray-200/60 rounded-2xl bg-white">
                <CardHeader className="border-b border-gray-100 pb-4">
                  <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
                    <Cpu className="h-5 w-5 text-[#009959]" /> AI Engine Brain
                  </CardTitle>
                  <CardDescription>Configure prompt instructions, model and AI provider.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 pt-5">
                  <div className="space-y-2">
                    <Label htmlFor="systemPrompt" className="text-xs font-semibold text-gray-600">System Instructions / Prompt</Label>
                    <Textarea
                      id="systemPrompt"
                      rows={8}
                      value={config.systemPrompt}
                      onChange={(e) => update("systemPrompt", e.target.value)}
                      placeholder="You are a helpful assistant..."
                      className="rounded-xl border-gray-200 focus:border-[#009959] focus:ring-[#009959]/20 text-sm leading-relaxed"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-gray-600">AI Provider</Label>
                      <Select value={config.provider} onValueChange={changeProvider}>
                        <SelectTrigger className="rounded-xl border-0 bg-slate-50 shadow-sm h-10">
                          {config.provider ? (
                            (() => {
                              const p = PROVIDERS.find((x) => x.value === config.provider);
                              return p ? (
                                <div className="flex items-center gap-2 min-w-0 pr-2">
                                  <span className="font-semibold text-xs text-gray-800">{p.label}</span>
                                </div>
                              ) : <SelectValue placeholder="Select provider" />;
                            })()
                          ) : <SelectValue placeholder="Select provider" />}
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl shadow-xl border-0 p-1.5 w-[280px]">
                          {PROVIDERS.map((p) => (
                            <SelectItem key={p.value} value={p.value} className="rounded-xl py-2.5 px-3 cursor-pointer focus:bg-slate-50 pr-8">
                              <div className="flex flex-col gap-0.5 w-full">
                                <span className="font-semibold text-xs text-gray-800">{p.label}</span>
                                <span className="text-[10px] text-gray-500 leading-tight">
                                  {p.value === "google" && "Gemini 3.5, 3.1 & 2.5 flash/pro"}
                                  {p.value === "xai" && "Grok 3 and Grok 2 reasoning"}
                                  {p.value === "mistral" && "Mistral Large, Medium, Small"}
                                  {p.value === "openrouter" && "Access 200+ models via OpenRouter"}
                                  {p.value === "ollama" && "Run private open-weights models locally"}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="model" className="text-xs font-semibold text-gray-600">Model Version</Label>
                        {config.provider === "ollama" && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={loadingOllama}
                            onClick={() => fetchLocalOllama(false)}
                            className="h-6 text-[10px] px-2 text-[#009959] hover:text-[#007d49] hover:bg-[#E6F7F0] rounded-lg gap-1 font-semibold"
                          >
                            {loadingOllama ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3 w-3" />
                            )}
                            Scan Local Models
                          </Button>
                        )}
                      </div>
                      {config.provider === "openrouter" ? (
                        <Select value={config.model} onValueChange={(v) => update("model", v)}>
                          <SelectTrigger className="rounded-xl border-0 bg-slate-50 shadow-sm h-10">
                            {config.model ? (
                              (() => {
                                const m = OPENROUTER_MODELS.find((x) => x.value === config.model);
                                return m ? (
                                  <div className="flex items-center gap-2 min-w-0 overflow-hidden pr-2">
                                    <span className="text-[10px] text-slate-400 font-medium shrink-0">{m.provider}</span>
                                    <span className="font-semibold text-xs text-gray-800 truncate">{m.label}</span>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${BADGE_COLORS[m.badge]}`}>{m.badge}</span>
                                  </div>
                                ) : <span className="text-xs text-gray-600 truncate">{config.model}</span>;
                              })()
                            ) : <SelectValue placeholder="Select a model" />}
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl shadow-xl border-0 p-1.5 max-h-[420px] w-[480px]">
                            {OPENROUTER_MODELS.map((m) => (
                              <SelectItem
                                key={m.value}
                                value={m.value}
                                className="rounded-xl py-2.5 px-3 cursor-pointer focus:bg-slate-50 pr-8"
                              >
                                <div className="flex flex-col gap-1 w-full">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wide shrink-0 w-14">{m.provider}</span>
                                    <span className="font-semibold text-xs text-gray-800 flex-1">{m.label}</span>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${BADGE_COLORS[m.badge]}`}>{m.badge}</span>
                                  </div>
                                  <div className="flex items-center gap-2 pl-16">
                                    <span className="text-[10px] text-gray-500 flex-1 leading-tight">{m.description}</span>
                                    <span className="text-[9px] font-mono text-emerald-700 shrink-0">in {m.inputPrice}</span>
                                    <span className="text-[9px] text-gray-400 shrink-0">·</span>
                                    <span className="text-[9px] font-mono text-rose-600 shrink-0">out {m.outputPrice}</span>
                                  </div>
                                </div>
                              </SelectItem>
                            ))}
                            {/* Custom model ID entry */}
                            <div className="mt-1 pt-1 border-t border-gray-100 px-2 pb-1">
                              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Custom model ID</p>
                              <div className="flex gap-2">
                                <Input
                                  value={customModelId}
                                  onChange={(e) => setCustomModelId(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && customModelId.trim()) {
                                      update("model", customModelId.trim());
                                      setCustomModelId("");
                                    }
                                  }}
                                  placeholder="e.g. cohere/command-r-plus"
                                  className="flex-1 h-7 text-xs rounded-lg border-gray-200 bg-white"
                                />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[11px] px-3 rounded-lg border-gray-200"
                                  onClick={() => {
                                    if (customModelId.trim()) {
                                      update("model", customModelId.trim());
                                      setCustomModelId("");
                                    }
                                  }}
                                >
                                  Load
                                </Button>
                              </div>
                              <p className="text-[9px] text-gray-400 mt-1">Enter any valid OpenRouter model ID from openrouter.ai/models</p>
                            </div>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Select value={config.model} onValueChange={(v) => update("model", v)}>
                          <SelectTrigger className="rounded-xl border-0 bg-slate-50 shadow-sm h-10">
                            {config.model ? (
                              (() => {
                                const opts = config.provider === "ollama"
                                  ? [...(MODELS.ollama || []), ...localOllamaModels].filter((v, i, a) => a.findIndex(t => t.value === v.value) === i)
                                  : MODELS[config.provider] ?? [];
                                const m = opts.find((x) => x.value === config.model);
                                return m ? (
                                  <div className="flex items-center gap-2 min-w-0 overflow-hidden pr-2">
                                    <span className="font-semibold text-xs text-gray-800 truncate flex-1">{m.label}</span>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${BADGE_COLORS[m.badge]}`}>{m.badge}</span>
                                  </div>
                                ) : <span className="text-xs text-gray-600 truncate">{config.model}</span>;
                              })()
                            ) : <SelectValue placeholder="Select model" />}
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl shadow-xl border-0 p-1.5 max-h-[360px] w-[360px]">
                            {(() => {
                              const opts = config.provider === "ollama"
                                ? [...(MODELS.ollama || []), ...localOllamaModels].filter((v, i, a) => a.findIndex(t => t.value === v.value) === i)
                                : MODELS[config.provider] ?? [];
                              return opts.map((m) => (
                                <SelectItem
                                  key={m.value}
                                  value={m.value}
                                  className="rounded-xl py-2.5 px-3 cursor-pointer focus:bg-slate-50 pr-8"
                                >
                                  <div className="flex flex-col gap-0.5 w-full">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-xs text-gray-800 flex-1">{m.label}</span>
                                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${BADGE_COLORS[m.badge]}`}>{m.badge}</span>
                                    </div>
                                    <span className="text-[10px] text-gray-500 leading-tight">{m.description}</span>
                                  </div>
                                </SelectItem>
                              ));
                            })()}
                            {config.provider === "ollama" && (
                              <div className="mt-1 pt-1 border-t border-gray-100 px-2 pb-1">
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Custom model name</p>
                                <div className="flex gap-2">
                                  <Input
                                    value={customModelId}
                                    onChange={(e) => setCustomModelId(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" && customModelId.trim()) {
                                        update("model", customModelId.trim());
                                        setCustomModelId("");
                                      }
                                    }}
                                    placeholder="e.g. mistral:7b-instruct"
                                    className="flex-1 h-7 text-xs rounded-lg border-gray-200 bg-white"
                                  />
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-[11px] px-3 rounded-lg border-gray-200"
                                    onClick={() => {
                                      if (customModelId.trim()) {
                                        update("model", customModelId.trim());
                                        setCustomModelId("");
                                      }
                                    }}
                                  >
                                    Load
                                  </Button>
                                </div>
                                <p className="text-[9px] text-gray-400 mt-1">Enter your local model tag from `ollama list`</p>
                              </div>
                            )}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-8">
              {/* Channels Card */}
              <Card className="shadow-sm border border-gray-200/60 rounded-2xl bg-white">
                <CardHeader className="pb-3 border-b border-gray-100">
                  <CardTitle className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <Radio className="h-4 w-4 text-[#009959]" /> Active Channels
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  {(["chat", "whatsapp", "voice"] as const).map((ch) => (
                    <div key={ch} className="flex items-center justify-between py-1">
                      <Label className="capitalize text-sm font-medium text-gray-700">{ch === "chat" ? "Web Chat" : ch}</Label>
                      <Switch
                        checked={config.channels[ch]}
                        onCheckedChange={(v) => update("channels", { ...config.channels, [ch]: v })}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Voice & Audio Card — always visible */}
              <Card className="shadow-sm border border-gray-200/60 rounded-2xl bg-white">
                <CardHeader className="pb-3 border-b border-gray-100">
                  <CardTitle className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <Volume2 className="h-4 w-4 text-[#009959]" /> Voice &amp; Audio
                  </CardTitle>
                  <CardDescription className="text-[11px] text-gray-500 mt-0.5">TTS and STT engines used by LiveKit voice agent</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 pt-4">

                  {/* TTS Dropdowns */}
                  <div className="space-y-4">
                    <Label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Text-to-Speech (TTS)</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-semibold text-gray-400">TTS Provider</Label>
                        <Select value={config.ttsProvider} onValueChange={(v) => {
                          update("ttsProvider", v);
                          // Clear or set default voice on provider change
                          update("ttsVoiceId", "");
                        }}>
                          <SelectTrigger className="rounded-xl border-0 bg-slate-50 shadow-sm h-10">
                            {(() => {
                              const t = TTS_OPTIONS.find((x) => x.value === config.ttsProvider);
                              return t ? (
                                <div className="flex items-center gap-2 min-w-0 pr-2">
                                  <span className="font-semibold text-xs text-gray-800">{t.label}</span>
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${AUDIO_BADGE_COLORS[t.badge]}`}>{t.badge}</span>
                                </div>
                              ) : <SelectValue placeholder="Select TTS Provider" />;
                            })()}
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl shadow-xl border-0 p-1.5 w-[320px]">
                            {TTS_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value} className="rounded-xl py-2.5 px-3 cursor-pointer focus:bg-slate-50 pr-8">
                                <div className="flex flex-col gap-0.5 w-full">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-xs text-gray-800">{opt.label}</span>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${AUDIO_BADGE_COLORS[opt.badge]}`}>{opt.badge}</span>
                                  </div>
                                  <span className="text-[10px] text-gray-500 leading-tight">{opt.description}</span>
                                  {opt.free && <span className="text-[9px] text-emerald-700 font-semibold mt-0.5">Free: {opt.free}</span>}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-semibold text-gray-400">Voice / Model ID</Label>
                        <Select value={config.ttsVoiceId || "default"} onValueChange={(v) => update("ttsVoiceId", v === "default" ? "" : v)}>
                          <SelectTrigger className="rounded-xl border-0 bg-slate-50 shadow-sm h-10">
                            <span className="font-semibold text-xs text-gray-800 truncate">
                              {config.ttsVoiceId || "Default Voice"}
                            </span>
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl shadow-xl border-0 p-1.5 w-[280px]">
                            <SelectItem value="default" className="rounded-xl py-2 px-3 cursor-pointer">Default / Fallback</SelectItem>
                            {config.ttsProvider === "ELEVENLABS" && (
                              <>
                                <SelectItem value="21m00Tcm4TlvDq8ikWAM" className="rounded-xl py-2 px-3 cursor-pointer">Rachel (Female, natural)</SelectItem>
                                <SelectItem value="AZnzlk1XvdvUeBnXmlld" className="rounded-xl py-2 px-3 cursor-pointer">Domi (Female, energetic)</SelectItem>
                                <SelectItem value="EXAVITQu4vr4xnSDxMaL" className="rounded-xl py-2 px-3 cursor-pointer">Bella (Female, soft)</SelectItem>
                                <SelectItem value="ErXwobaYiN019PkySvjV" className="rounded-xl py-2 px-3 cursor-pointer">Antoni (Male, deep)</SelectItem>
                              </>
                            )}
                            {config.ttsProvider === "OPENAI" && (
                              <>
                                <SelectItem value="alloy" className="rounded-xl py-2 px-3 cursor-pointer">Alloy (Balanced)</SelectItem>
                                <SelectItem value="echo" className="rounded-xl py-2 px-3 cursor-pointer">Echo (Warm)</SelectItem>
                                <SelectItem value="fable" className="rounded-xl py-2 px-3 cursor-pointer">Fable (Narrative)</SelectItem>
                                <SelectItem value="onyx" className="rounded-xl py-2 px-3 cursor-pointer">Onyx (Deep male)</SelectItem>
                                <SelectItem value="nova" className="rounded-xl py-2 px-3 cursor-pointer">Nova (Bright female)</SelectItem>
                                <SelectItem value="shimmer" className="rounded-xl py-2 px-3 cursor-pointer">Shimmer (Professional)</SelectItem>
                              </>
                            )}
                            {config.ttsProvider === "CARTESIA" && (
                              <>
                                <SelectItem value="a0e99841-438c-4a64-b679-ae501e7d6091" className="rounded-xl py-2 px-3 cursor-pointer">Barack Obama (Clone)</SelectItem>
                                <SelectItem value="2c6a0c5c-7d9b-44c1-8408-ae501e7d6091" className="rounded-xl py-2 px-3 cursor-pointer">News Anchor (Male)</SelectItem>
                                <SelectItem value="6f9a0c5c-7d9b-44c1-8408-ae501e7d6091" className="rounded-xl py-2 px-3 cursor-pointer">Support Agent (Female)</SelectItem>
                              </>
                            )}
                            {config.ttsProvider === "AZURE" && (
                              <>
                                <SelectItem value="en-US-JennyNeural" className="rounded-xl py-2 px-3 cursor-pointer">Jenny Neural (Female)</SelectItem>
                                <SelectItem value="en-US-GuyNeural" className="rounded-xl py-2 px-3 cursor-pointer">Guy Neural (Male)</SelectItem>
                                <SelectItem value="en-US-AriaNeural" className="rounded-xl py-2 px-3 cursor-pointer">Aria Neural (Female)</SelectItem>
                              </>
                            )}
                            {config.ttsProvider === "GOOGLE" && (
                              <>
                                <SelectItem value="en-US-Chirp-HD-F" className="rounded-xl py-2 px-3 cursor-pointer">Chirp HD Female</SelectItem>
                                <SelectItem value="en-US-Chirp-HD-M" className="rounded-xl py-2 px-3 cursor-pointer">Chirp HD Male</SelectItem>
                                <SelectItem value="en-US-Wavenet-D" className="rounded-xl py-2 px-3 cursor-pointer">Wavenet Male</SelectItem>
                                <SelectItem value="en-US-Wavenet-F" className="rounded-xl py-2 px-3 cursor-pointer">Wavenet Female</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* STT Dropdowns */}
                  <div className="space-y-4 pt-4 border-t border-gray-100">
                    <Label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Speech-to-Text (STT)</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-semibold text-gray-400">STT Provider</Label>
                        <Select value={config.sttProvider} onValueChange={(v) => {
                          update("sttProvider", v);
                        }}>
                          <SelectTrigger className="rounded-xl border-0 bg-slate-50 shadow-sm h-10">
                            {(() => {
                              const s = STT_OPTIONS.find((x) => x.value === config.sttProvider);
                              return s ? (
                                <div className="flex items-center gap-2 min-w-0 pr-2">
                                  <span className="font-semibold text-xs text-gray-800">{s.label}</span>
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${AUDIO_BADGE_COLORS[s.badge]}`}>{s.badge}</span>
                                </div>
                              ) : <SelectValue placeholder="Select STT Provider" />;
                            })()}
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl shadow-xl border-0 p-1.5 w-[320px]">
                            {STT_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value} className="rounded-xl py-2.5 px-3 cursor-pointer focus:bg-slate-50 pr-8">
                                <div className="flex flex-col gap-0.5 w-full">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-xs text-gray-800">{opt.label}</span>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${AUDIO_BADGE_COLORS[opt.badge]}`}>{opt.badge}</span>
                                  </div>
                                  <span className="text-[10px] text-gray-500 leading-tight">{opt.description}</span>
                                  {opt.free && <span className="text-[9px] text-emerald-700 font-semibold mt-0.5">Free: {opt.free}</span>}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-semibold text-gray-400">STT Model / Version</Label>
                        <Select value={config.sttProvider === "DEEPGRAM" ? "nova-3" : "latest"} disabled>
                          <SelectTrigger className="rounded-xl border-0 bg-slate-50 shadow-sm h-10 opacity-70 cursor-not-allowed">
                            <span className="font-semibold text-xs text-slate-500">
                              {config.sttProvider === "DEEPGRAM" && "nova-3 (Nova-3)"}
                              {config.sttProvider === "GOOGLE" && "chirp-2 (Chirp 2)"}
                              {config.sttProvider === "AZURE" && "neural-v4 (Neural)"}
                              {config.sttProvider === "WHISPER" && "whisper-1 (Whisper)"}
                            </span>
                          </SelectTrigger>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Greeting Text Input */}
                  <div className="space-y-3 pt-4 border-t border-gray-100">
                    <div className="space-y-1">
                      <Label htmlFor="firstMessage" className="text-[11px] font-semibold text-gray-500">First Message / Greeting</Label>
                      <Input id="firstMessage" value={config.firstMessage} onChange={(e) => update("firstMessage", e.target.value)} className="rounded-xl border-0 bg-slate-50 shadow-sm h-9 text-xs" placeholder="Hello! How can I help you today?" />
                    </div>
                  </div>

                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Knowledge Bases */}
        <TabsContent value="knowledge" className="space-y-6">
          <Card className="shadow-sm border border-gray-200/60 rounded-2xl bg-white max-w-3xl">
            <CardHeader className="pb-3 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
                  <Database className="h-5 w-5 text-[#009959]" /> Knowledge Bases (RAG)
                </CardTitle>
                <CardDescription className="text-xs text-gray-500 mt-1">Select the knowledge bases this agent has access to.</CardDescription>
              </div>
              <Link href={`/agent/${agentId}/knowledge-base`}>
                <Button variant="outline" size="sm" className="text-xs gap-1.5 rounded-xl border-gray-200 text-gray-700 hover:bg-slate-50 transition-colors">
                  Go to Knowledge Base Manager <ExternalLink className="h-3 w-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="pt-5">
              {kbs.length === 0 ? (
                <p className="text-xs text-gray-400">No knowledge bases found in this workspace.</p>
              ) : (
                <div className="space-y-2">
                  {kbs.map((kb) => (
                    <label key={kb.id} className="flex items-center justify-between rounded-xl border border-gray-150 p-3 cursor-pointer hover:bg-slate-50 transition-colors">
                      <span className="text-xs font-medium text-gray-700">{kb.name}</span>
                      <Switch
                        checked={config.knowledgeBaseIds.includes(kb.id)}
                        onCheckedChange={() => toggleInArray("knowledgeBaseIds", kb.id)}
                      />
                    </label>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Functional Tools */}
        <TabsContent value="tools" className="space-y-6">
          <Card className="shadow-sm border border-gray-200/60 rounded-2xl bg-white max-w-3xl">
            <CardHeader className="pb-3 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-[#009959]" /> Functional Tools
                </CardTitle>
                <CardDescription className="text-xs text-gray-500 mt-1">Configure functional capabilities this agent can invoke.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-5">
              {tools.length === 0 ? (
                <p className="text-xs text-gray-400">No workspace tools configured.</p>
              ) : (
                <div className="space-y-2">
                  {tools.map((tool) => (
                    <label key={tool.id} className="flex items-center justify-between rounded-xl border border-gray-150 p-3 cursor-pointer hover:bg-slate-50 transition-colors">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-gray-700">{tool.name}</span>
                        <span className="text-[9px] text-gray-400 font-mono mt-0.5">{tool.type}</span>
                      </div>
                      <Switch
                        checked={config.toolIds.includes(tool.id)}
                        onCheckedChange={() => toggleInArray("toolIds", tool.id)}
                      />
                    </label>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

