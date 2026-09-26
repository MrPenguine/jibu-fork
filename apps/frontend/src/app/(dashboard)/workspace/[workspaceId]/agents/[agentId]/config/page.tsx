"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getAgentConfig,
  updateAgentConfig,
  getOllamaModels,
  linkAgentKnowledgeBase,
  listWorkspaceTools,
  createTool,
  deleteTool,
  listIntents,
  createIntent,
  updateIntent,
  deleteIntent,
  type AgentConfig,
  type WorkspaceToolFull,
  type CreatableToolType,
  type ToolFunctionParameter,
  type Intent,
} from "../../../../../../../utils/agentConfigApi";
import { listKnowledgeBases, createKnowledgeBase, updateKnowledgeBase, deleteKnowledgeBase, type KnowledgeBase, type KnowledgeBaseVisibility } from "../../../../../../../utils/knowledgebaseApi";
import { cn } from "@libs/shadcn-ui/lib/utils";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@libs/shadcn-ui/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@libs/shadcn-ui/components/ui/radio-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@libs/shadcn-ui/components/ui/alert-dialog";
import { toast } from "@libs/shadcn-ui/components/ui/use-toast";
import { Bot, Save, Sliders, Database, Cpu, Wrench, Radio, Volume2, Loader2, RefreshCw, Plus, Trash2, Play, Upload, Check } from "lucide-react";

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
  // No static "ollama" entry — its model list is only ever what's actually
  // pulled locally (scanned live), never a hardcoded guess the user may not have.
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
  Stable:   "bg-green-50 text-green-700 border border-green-200",
  Preview:  "bg-amber-50 text-amber-700 border border-amber-200",
  Free:     "bg-accent text-primary border border-green-200",
  Fast:     "bg-accent text-primary border border-green-200",
  Smart:    "bg-accent text-primary border border-green-200",
  Balanced: "bg-background text-muted-foreground border border-border",
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
  Free: "bg-green-50 text-green-700 border border-green-200",
  Paid: "bg-muted text-muted-foreground border border-border",
  Best: "bg-accent text-primary border border-green-200",
};

const TTS_PROVIDERS = TTS_OPTIONS.map((o) => o.value);
const STT_PROVIDERS = STT_OPTIONS.map((o) => o.value);

export default function AgentConfigPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.agentId as string;
  const workspaceId = params.workspaceId as string;

  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [tools, setTools] = useState<WorkspaceToolFull[]>([]);
  const [intents, setIntents] = useState<Intent[]>([]);
  const [kbs, setKbs] = useState<KnowledgeBase[]>([]);
  const [openCreateTool, setOpenCreateTool] = useState(false);
  const [creatingTool, setCreatingTool] = useState(false);
  const [openCreateIntent, setOpenCreateIntent] = useState(false);
  const [creatingIntent, setCreatingIntent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openCreateKb, setOpenCreateKb] = useState(false);
  const [creatingKb, setCreatingKb] = useState(false);
  const [newKbName, setNewKbName] = useState("");
  const [newKbVisibility, setNewKbVisibility] = useState<KnowledgeBaseVisibility>("AGENT");
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
        const [cfg, toolList, intentList, kbList] = await Promise.all([
          getAgentConfig(agentId),
          listWorkspaceTools().catch(() => []),
          listIntents(agentId).catch(() => []),
          listKnowledgeBases().catch(() => []),
        ]);
        setConfig(cfg);
        setTools(toolList);
        setIntents(intentList);
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
    // Ollama has no static default — its model list is only ever the
    // locally-scanned one, populated by the "Scan Local Models" effect below.
    const defaultModel = provider === "openrouter" || provider === "ollama" ? "" : MODELS[provider]?.[0]?.value ?? "";
    setConfig((prev) => (prev ? { ...prev, provider, model: defaultModel } : prev));
  };

  const toggleInArray = (key: "toolIds" | "knowledgeBaseIds" | "intentIds", id: string) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const set = new Set(prev[key]);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...prev, [key]: Array.from(set) };
    });
  };

  // Toggling an intent on unions its tools into toolIds immediately (matches
  // what the backend does on save) so the flat tool list reflects it right
  // away. Toggling off never removes tools — same non-destructive rule the
  // backend follows, since another attached intent (or a manual attach)
  // might still need them.
  const toggleIntent = (intent: Intent) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const intentSet = new Set(prev.intentIds);
      const turningOn = !intentSet.has(intent.id);
      if (turningOn) intentSet.add(intent.id);
      else intentSet.delete(intent.id);

      let toolIds = prev.toolIds;
      if (turningOn) {
        const toolSet = new Set(prev.toolIds);
        intent.tools.forEach((t) => toolSet.add(t.toolId));
        toolIds = Array.from(toolSet);
      }
      return { ...prev, intentIds: Array.from(intentSet), toolIds };
    });
  };

  // ── Create Tool form state ──────────────────────────────────────────
  const [newToolName, setNewToolName] = useState("");
  const [newToolDescription, setNewToolDescription] = useState("");
  const [newToolType, setNewToolType] = useState<CreatableToolType>("http.post");
  const [newToolParams, setNewToolParams] = useState<ToolFunctionParameter[]>([]);
  const [newToolUrl, setNewToolUrl] = useState("");
  const [newToolMethod, setNewToolMethod] = useState<"GET" | "POST">("POST");
  const [newToolWorkflowId, setNewToolWorkflowId] = useState("");
  const [newToolWebhookUrl, setNewToolWebhookUrl] = useState("");
  const [newToolRequiresConfirmation, setNewToolRequiresConfirmation] = useState(false);
  const [newToolRequiredSlots, setNewToolRequiredSlots] = useState("");

  const resetCreateToolForm = () => {
    setNewToolName("");
    setNewToolDescription("");
    setNewToolType("http.post");
    setNewToolParams([]);
    setNewToolUrl("");
    setNewToolMethod("POST");
    setNewToolWorkflowId("");
    setNewToolWebhookUrl("");
    setNewToolRequiresConfirmation(false);
    setNewToolRequiredSlots("");
  };

  const handleCreateTool = async () => {
    if (!newToolName.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (newToolType !== "n8n.webhook" && !newToolUrl.trim()) {
      toast({ title: "URL is required", variant: "destructive" });
      return;
    }
    if (newToolType === "n8n.webhook" && !newToolWebhookUrl.trim()) {
      toast({ title: "Webhook URL is required", variant: "destructive" });
      return;
    }
    setCreatingTool(true);
    try {
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const p of newToolParams) {
        if (!p.name.trim()) continue;
        properties[p.name.trim()] = { type: p.type, description: p.description || undefined };
        if (p.required) required.push(p.name.trim());
      }
      const fn = {
        name: newToolName.trim().replace(/[^a-zA-Z0-9_]/g, "_"),
        description: newToolDescription || undefined,
        parameters: { type: "object", properties, required },
      };
      const metadata =
        newToolType === "n8n.webhook"
          ? { workflowId: newToolWorkflowId || undefined, webhookUrl: newToolWebhookUrl }
          : { url: newToolUrl, method: newToolMethod };

      const created = await createTool({
        name: newToolName.trim(),
        description: newToolDescription || undefined,
        type: newToolType,
        function: fn,
        metadata,
        requiresConfirmation: newToolRequiresConfirmation,
        requiredSlots: newToolRequiredSlots
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setTools((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setOpenCreateTool(false);
      resetCreateToolForm();
      toast({ title: "Tool created", description: `"${created.name}" is ready to attach.` });
    } catch (e) {
      toast({ title: "Failed to create tool", description: String(e), variant: "destructive" });
    } finally {
      setCreatingTool(false);
    }
  };

  const handleDeleteTool = async (toolId: string) => {
    try {
      await deleteTool(toolId);
      setTools((prev) => prev.filter((t) => t.id !== toolId));
      setConfig((prev) => (prev ? { ...prev, toolIds: prev.toolIds.filter((id) => id !== toolId) } : prev));
      toast({ title: "Tool deleted" });
    } catch (e) {
      toast({ title: "Failed to delete tool", description: String(e), variant: "destructive" });
    }
  };

  const addToolParam = () => {
    setNewToolParams((prev) => [...prev, { name: "", type: "string", description: "", required: false }]);
  };

  const updateToolParam = (index: number, patch: Partial<ToolFunctionParameter>) => {
    setNewToolParams((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  };

  const removeToolParam = (index: number) => {
    setNewToolParams((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Create Intent form state ────────────────────────────────────────
  const [newIntentName, setNewIntentName] = useState("");
  const [newIntentDescription, setNewIntentDescription] = useState("");
  const [newIntentPromptSnippet, setNewIntentPromptSnippet] = useState("");
  const [newIntentToolIds, setNewIntentToolIds] = useState<string[]>([]);

  const resetCreateIntentForm = () => {
    setNewIntentName("");
    setNewIntentDescription("");
    setNewIntentPromptSnippet("");
    setNewIntentToolIds([]);
  };

  const handleCreateIntent = async () => {
    if (!newIntentName.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    setCreatingIntent(true);
    try {
      const created = await createIntent({
        name: newIntentName.trim(),
        description: newIntentDescription || undefined,
        promptSnippet: newIntentPromptSnippet || undefined,
        agentId,
        toolIds: newIntentToolIds,
      });
      setIntents((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setOpenCreateIntent(false);
      resetCreateIntentForm();
      toast({ title: "Intent created", description: `"${created.name}" is ready to attach.` });
    } catch (e) {
      toast({ title: "Failed to create intent", description: String(e), variant: "destructive" });
    } finally {
      setCreatingIntent(false);
    }
  };

  const handleDeleteIntent = async (intentId: string) => {
    try {
      await deleteIntent(intentId);
      setIntents((prev) => prev.filter((i) => i.id !== intentId));
      setConfig((prev) => (prev ? { ...prev, intentIds: prev.intentIds.filter((id) => id !== intentId) } : prev));
      toast({ title: "Intent deleted" });
    } catch (e) {
      toast({ title: "Failed to delete intent", description: String(e), variant: "destructive" });
    }
  };

  const toggleNewIntentTool = (toolId: string) => {
    setNewIntentToolIds((prev) => (prev.includes(toolId) ? prev.filter((id) => id !== toolId) : [...prev, toolId]));
  };

  const handleCreateKb = async () => {
    if (!newKbName.trim()) return;
    setCreatingKb(true);
    try {
      const kb = await createKnowledgeBase(newKbName.trim(), { visibility: newKbVisibility });
      await linkAgentKnowledgeBase(agentId, kb.id);
      setKbs((prev) => [kb, ...prev]);
      setConfig((prev) => (prev ? { ...prev, knowledgeBaseIds: [...prev.knowledgeBaseIds, kb.id] } : prev));
      setOpenCreateKb(false);
      setNewKbName("");
      setNewKbVisibility("AGENT");
      toast({ title: "Knowledge base created", description: `"${kb.name}" is ready — add data sources to it now.` });
      router.push(`/workspace/${workspaceId}/agents/${agentId}/knowledge-base/${kb.id}`);
    } catch (e) {
      toast({ title: "Failed to create knowledge base", description: String(e), variant: "destructive" });
    } finally {
      setCreatingKb(false);
    }
  };

  const handleChangeKbVisibility = async (kbId: string, visibility: KnowledgeBaseVisibility) => {
    const previous = kbs;
    setKbs((prev) => prev.map((kb) => (kb.id === kbId ? { ...kb, visibility } : kb)));
    try {
      await updateKnowledgeBase(kbId, { visibility });
    } catch (e) {
      setKbs(previous);
      toast({ title: "Failed to update visibility", description: String(e), variant: "destructive" });
    }
  };

  const handleDeleteKb = async (kbId: string) => {
    const ok = await deleteKnowledgeBase(kbId);
    if (!ok) {
      toast({ title: "Failed to delete knowledge base", variant: "destructive" });
      return;
    }
    setKbs((prev) => prev.filter((kb) => kb.id !== kbId));
    setConfig((prev) => (prev ? { ...prev, knowledgeBaseIds: prev.knowledgeBaseIds.filter((id) => id !== kbId) } : prev));
    toast({ title: "Knowledge base deleted" });
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
        <Skeleton className="h-12 w-1/3 rounded-lg" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-44 w-full rounded-lg" />
            <Skeleton className="h-96 w-full rounded-lg" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-48 w-full rounded-lg" />
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  const modelOptions = MODELS[config.provider] || [];
  const linkedKbs = kbs.filter((kb) => config.knowledgeBaseIds.includes(kb.id));
  const attachableKbs = kbs.filter((kb) => kb.visibility === "WORKSPACE" && !config.knowledgeBaseIds.includes(kb.id));

  return (
    <div className="bg-background min-h-screen">
      {/* Header spans full width, above the sidebar+content row below */}
      <div className="flex items-center justify-between border-b border-border px-8 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-brand-green">
            <Sliders className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Configure Agent</h1>
            <p className="text-xs text-muted-foreground">Customize prompt instructions, AI models, knowledge, and tools.</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="bg-brand-green hover:bg-brand-green/90 text-white rounded-md shadow-sm px-5 py-5 gap-2 transition-all">
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* Secondary sidebar + content, same pattern as the app's own primary
          nav (light bg, active item tinted brand-green) — scales cleanly as
          more sections (Voice, Channels, Testing...) get added later,
          rather than an ever-widening horizontal tab strip. */}
      <Tabs defaultValue="general" orientation="vertical" className="flex items-start w-full">
        <TabsList className="flex flex-col items-stretch gap-1 w-56 shrink-0 h-auto bg-transparent p-4 border-r border-border sticky top-0">
          <TabsTrigger
            value="general"
            className="justify-start gap-2.5 rounded-lg text-sm font-medium px-3 py-2.5 h-auto data-[state=active]:bg-accent data-[state=active]:text-brand-green data-[state=active]:shadow-none"
          >
            <Sliders className="h-4 w-4" /> General &amp; Brain
          </TabsTrigger>
          <TabsTrigger
            value="knowledge"
            className="justify-start gap-2.5 rounded-lg text-sm font-medium px-3 py-2.5 h-auto data-[state=active]:bg-accent data-[state=active]:text-brand-green data-[state=active]:shadow-none"
          >
            <Database className="h-4 w-4" /> Knowledge Bases
          </TabsTrigger>
          <TabsTrigger
            value="tools"
            className="justify-start gap-2.5 rounded-lg text-sm font-medium px-3 py-2.5 h-auto data-[state=active]:bg-accent data-[state=active]:text-brand-green data-[state=active]:shadow-none"
          >
            <Wrench className="h-4 w-4" /> Tools
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 min-w-0 p-8 max-w-5xl">
        {/* Tab 1: General & Brain settings */}
        <TabsContent value="general" className="space-y-6 mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2 space-y-8">
              <Card className="shadow-sm border border-border/60 rounded-lg bg-card">
                <CardHeader className="border-b border-gray-100 pb-4">
                  <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                    <Bot className="h-5 w-5 text-brand-green" /> Basics
                  </CardTitle>
                  <CardDescription>Identity parameters for this agent.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-5">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-xs font-semibold text-muted-foreground">Agent Name</Label>
                    <Input id="name" value={config.name} onChange={(e) => update("name", e.target.value)} className="rounded-md border-border focus:border-brand-green focus:ring-brand-green/20" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-xs font-semibold text-muted-foreground">Description</Label>
                    <Input id="description" value={config.description} onChange={(e) => update("description", e.target.value)} className="rounded-md border-border focus:border-brand-green focus:ring-brand-green/20" />
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm border border-border/60 rounded-lg bg-card">
                <CardHeader className="border-b border-gray-100 pb-4">
                  <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                    <Cpu className="h-5 w-5 text-brand-green" /> AI Engine Brain
                  </CardTitle>
                  <CardDescription>Configure prompt instructions, model and AI provider.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 pt-5">
                  <div className="space-y-2">
                    <Label htmlFor="systemPrompt" className="text-xs font-semibold text-muted-foreground">System Instructions / Prompt</Label>
                    <Textarea
                      id="systemPrompt"
                      rows={8}
                      value={config.systemPrompt}
                      onChange={(e) => update("systemPrompt", e.target.value)}
                      placeholder="You are a helpful assistant..."
                      className="rounded-lg border-border focus:border-brand-green focus:ring-brand-green/20 text-sm leading-relaxed"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground">AI Provider</Label>
                      <Select value={config.provider} onValueChange={changeProvider}>
                        <SelectTrigger className="rounded-md border border-input bg-card shadow-sm h-10 focus:border-brand-green focus:ring-2 focus:ring-brand-green/20">
                          {config.provider ? (
                            (() => {
                              const p = PROVIDERS.find((x) => x.value === config.provider);
                              return p ? (
                                <div className="flex items-center gap-2 min-w-0 pr-2">
                                  <span className="font-semibold text-xs text-foreground">{p.label}</span>
                                </div>
                              ) : <SelectValue placeholder="Select provider" />;
                            })()
                          ) : <SelectValue placeholder="Select provider" />}
                        </SelectTrigger>
                        <SelectContent className="rounded-lg shadow-xl border border-border p-1.5 w-[280px]">
                          {PROVIDERS.map((p) => (
                            <SelectItem key={p.value} value={p.value} className="rounded-md py-2.5 px-3 cursor-pointer focus:bg-background pr-8">
                              <div className="flex flex-col gap-0.5 w-full">
                                <span className="font-semibold text-xs text-foreground">{p.label}</span>
                                <span className="text-[10px] text-muted-foreground leading-tight">
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
                        <Label htmlFor="model" className="text-xs font-semibold text-muted-foreground">Model Version</Label>
                        {config.provider === "ollama" && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={loadingOllama}
                            onClick={() => fetchLocalOllama(false)}
                            className="h-6 text-[10px] px-2 text-brand-green hover:text-brand-green/90 hover:bg-accent rounded-lg gap-1 font-semibold"
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
                          <SelectTrigger className="rounded-md border border-input bg-card shadow-sm h-10 focus:border-brand-green focus:ring-2 focus:ring-brand-green/20">
                            {config.model ? (
                              (() => {
                                const m = OPENROUTER_MODELS.find((x) => x.value === config.model);
                                return m ? (
                                  <div className="flex items-center gap-2 min-w-0 overflow-hidden pr-2">
                                    <span className="text-[10px] text-gray-400 font-medium shrink-0">{m.provider}</span>
                                    <span className="font-semibold text-xs text-foreground truncate">{m.label}</span>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${BADGE_COLORS[m.badge]}`}>{m.badge}</span>
                                  </div>
                                ) : <span className="text-xs text-muted-foreground truncate">{config.model}</span>;
                              })()
                            ) : <SelectValue placeholder="Select a model" />}
                          </SelectTrigger>
                          <SelectContent className="rounded-lg shadow-xl border border-border p-1.5 max-h-[420px] w-[480px]">
                            {OPENROUTER_MODELS.map((m) => (
                              <SelectItem
                                key={m.value}
                                value={m.value}
                                className="rounded-md py-2.5 px-3 cursor-pointer focus:bg-background pr-8"
                              >
                                <div className="flex flex-col gap-1 w-full">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[9px] text-gray-400 font-semibold uppercase tracking-wide shrink-0 w-14">{m.provider}</span>
                                    <span className="font-semibold text-xs text-foreground flex-1">{m.label}</span>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${BADGE_COLORS[m.badge]}`}>{m.badge}</span>
                                  </div>
                                  <div className="flex items-center gap-2 pl-16">
                                    <span className="text-[10px] text-muted-foreground flex-1 leading-tight">{m.description}</span>
                                    <span className="text-[9px] font-mono text-green-700 shrink-0">in {m.inputPrice}</span>
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
                                  className="flex-1 h-7 text-xs rounded-lg border-border bg-card"
                                />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[11px] px-3 rounded-lg border-border"
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
                          <SelectTrigger className="rounded-md border border-input bg-card shadow-sm h-10 focus:border-brand-green focus:ring-2 focus:ring-brand-green/20">
                            {config.model ? (
                              (() => {
                                const opts = config.provider === "ollama" ? localOllamaModels : MODELS[config.provider] ?? [];
                                const m = opts.find((x) => x.value === config.model);
                                return m ? (
                                  <div className="flex items-center gap-2 min-w-0 overflow-hidden pr-2">
                                    <span className="font-semibold text-xs text-foreground truncate flex-1">{m.label}</span>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${BADGE_COLORS[m.badge]}`}>{m.badge}</span>
                                  </div>
                                ) : <span className="text-xs text-muted-foreground truncate">{config.model}</span>;
                              })()
                            ) : <SelectValue placeholder="Select model" />}
                          </SelectTrigger>
                          <SelectContent className="rounded-lg shadow-xl border border-border p-1.5 max-h-[360px] w-[360px]">
                            {(() => {
                              const opts = config.provider === "ollama" ? localOllamaModels : MODELS[config.provider] ?? [];
                              return opts.map((m) => (
                                <SelectItem
                                  key={m.value}
                                  value={m.value}
                                  className="rounded-md py-2.5 px-3 cursor-pointer focus:bg-background pr-8"
                                >
                                  <div className="flex flex-col gap-0.5 w-full">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-xs text-foreground flex-1">{m.label}</span>
                                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${BADGE_COLORS[m.badge]}`}>{m.badge}</span>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground leading-tight">{m.description}</span>
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
                                    className="flex-1 h-7 text-xs rounded-lg border-border bg-card"
                                  />
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-[11px] px-3 rounded-lg border-border"
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
              <Card className="shadow-sm border border-border/60 rounded-lg bg-card">
                <CardHeader className="pb-3 border-b border-gray-100">
                  <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Radio className="h-4 w-4 text-brand-green" /> Active Channels
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
              <Card className="shadow-sm border border-border/60 rounded-lg bg-card">
                <CardHeader className="pb-3 border-b border-gray-100">
                  <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Volume2 className="h-4 w-4 text-brand-green" /> Voice &amp; Audio
                  </CardTitle>
                  <CardDescription className="text-[11px] text-muted-foreground mt-0.5">TTS and STT engines used by LiveKit voice agent</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 pt-4">

                  {/* TTS Dropdowns */}
                  <div className="space-y-4">
                    <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Text-to-Speech (TTS)</Label>
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-semibold text-gray-400 whitespace-nowrap">TTS Provider</Label>
                        <Select value={config.ttsProvider} onValueChange={(v) => {
                          update("ttsProvider", v);
                          // Clear or set default voice on provider change
                          update("ttsVoiceId", "");
                        }}>
                          <SelectTrigger className="rounded-md border border-input bg-card shadow-sm h-10 focus:border-brand-green focus:ring-2 focus:ring-brand-green/20">
                            {(() => {
                              const t = TTS_OPTIONS.find((x) => x.value === config.ttsProvider);
                              return t ? (
                                <div className="flex items-center gap-2 min-w-0 pr-2">
                                  <span className="font-semibold text-xs text-foreground truncate">{t.label}</span>
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${AUDIO_BADGE_COLORS[t.badge]}`}>{t.badge}</span>
                                </div>
                              ) : <SelectValue placeholder="Select TTS Provider" />;
                            })()}
                          </SelectTrigger>
                          <SelectContent className="rounded-lg shadow-xl border border-border p-1.5 w-[320px]">
                            {TTS_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value} className="rounded-md py-2.5 px-3 cursor-pointer focus:bg-background pr-8">
                                <div className="flex flex-col gap-0.5 w-full">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-xs text-foreground">{opt.label}</span>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${AUDIO_BADGE_COLORS[opt.badge]}`}>{opt.badge}</span>
                                  </div>
                                  <span className="text-[10px] text-muted-foreground leading-tight">{opt.description}</span>
                                  {opt.free && <span className="text-[9px] text-green-700 font-semibold mt-0.5">Free: {opt.free}</span>}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-semibold text-gray-400 whitespace-nowrap">Voice / Model ID</Label>
                        <Select value={config.ttsVoiceId || "default"} onValueChange={(v) => update("ttsVoiceId", v === "default" ? "" : v)}>
                          <SelectTrigger className="rounded-md border border-input bg-card shadow-sm h-10 focus:border-brand-green focus:ring-2 focus:ring-brand-green/20">
                            <span className="font-semibold text-xs text-foreground truncate">
                              {config.ttsVoiceId || "Default Voice"}
                            </span>
                          </SelectTrigger>
                          <SelectContent className="rounded-lg shadow-xl border border-border p-1.5 w-[280px]">
                            <SelectItem value="default" className="rounded-md py-2 px-3 cursor-pointer">Default / Fallback</SelectItem>
                            {config.ttsProvider === "ELEVENLABS" && (
                              <>
                                <SelectItem value="21m00Tcm4TlvDq8ikWAM" className="rounded-md py-2 px-3 cursor-pointer">Rachel (Female, natural)</SelectItem>
                                <SelectItem value="AZnzlk1XvdvUeBnXmlld" className="rounded-md py-2 px-3 cursor-pointer">Domi (Female, energetic)</SelectItem>
                                <SelectItem value="EXAVITQu4vr4xnSDxMaL" className="rounded-md py-2 px-3 cursor-pointer">Bella (Female, soft)</SelectItem>
                                <SelectItem value="ErXwobaYiN019PkySvjV" className="rounded-md py-2 px-3 cursor-pointer">Antoni (Male, deep)</SelectItem>
                              </>
                            )}
                            {config.ttsProvider === "OPENAI" && (
                              <>
                                <SelectItem value="alloy" className="rounded-md py-2 px-3 cursor-pointer">Alloy (Balanced)</SelectItem>
                                <SelectItem value="echo" className="rounded-md py-2 px-3 cursor-pointer">Echo (Warm)</SelectItem>
                                <SelectItem value="fable" className="rounded-md py-2 px-3 cursor-pointer">Fable (Narrative)</SelectItem>
                                <SelectItem value="onyx" className="rounded-md py-2 px-3 cursor-pointer">Onyx (Deep male)</SelectItem>
                                <SelectItem value="nova" className="rounded-md py-2 px-3 cursor-pointer">Nova (Bright female)</SelectItem>
                                <SelectItem value="shimmer" className="rounded-md py-2 px-3 cursor-pointer">Shimmer (Professional)</SelectItem>
                              </>
                            )}
                            {config.ttsProvider === "CARTESIA" && (
                              <>
                                <SelectItem value="a0e99841-438c-4a64-b679-ae501e7d6091" className="rounded-md py-2 px-3 cursor-pointer">Barack Obama (Clone)</SelectItem>
                                <SelectItem value="2c6a0c5c-7d9b-44c1-8408-ae501e7d6091" className="rounded-md py-2 px-3 cursor-pointer">News Anchor (Male)</SelectItem>
                                <SelectItem value="6f9a0c5c-7d9b-44c1-8408-ae501e7d6091" className="rounded-md py-2 px-3 cursor-pointer">Support Agent (Female)</SelectItem>
                              </>
                            )}
                            {config.ttsProvider === "AZURE" && (
                              <>
                                <SelectItem value="en-US-JennyNeural" className="rounded-md py-2 px-3 cursor-pointer">Jenny Neural (Female)</SelectItem>
                                <SelectItem value="en-US-GuyNeural" className="rounded-md py-2 px-3 cursor-pointer">Guy Neural (Male)</SelectItem>
                                <SelectItem value="en-US-AriaNeural" className="rounded-md py-2 px-3 cursor-pointer">Aria Neural (Female)</SelectItem>
                              </>
                            )}
                            {config.ttsProvider === "GOOGLE" && (
                              <>
                                <SelectItem value="en-US-Chirp-HD-F" className="rounded-md py-2 px-3 cursor-pointer">Chirp HD Female</SelectItem>
                                <SelectItem value="en-US-Chirp-HD-M" className="rounded-md py-2 px-3 cursor-pointer">Chirp HD Male</SelectItem>
                                <SelectItem value="en-US-Wavenet-D" className="rounded-md py-2 px-3 cursor-pointer">Wavenet Male</SelectItem>
                                <SelectItem value="en-US-Wavenet-F" className="rounded-md py-2 px-3 cursor-pointer">Wavenet Female</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* STT Dropdowns */}
                  <div className="space-y-4 pt-4 border-t border-gray-100">
                    <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Speech-to-Text (STT)</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-semibold text-gray-400 whitespace-nowrap">STT Provider</Label>
                        <Select value={config.sttProvider} onValueChange={(v) => {
                          update("sttProvider", v);
                        }}>
                          <SelectTrigger className="rounded-md border border-input bg-card shadow-sm h-10 focus:border-brand-green focus:ring-2 focus:ring-brand-green/20">
                            {(() => {
                              const s = STT_OPTIONS.find((x) => x.value === config.sttProvider);
                              return s ? (
                                <div className="flex items-center gap-2 min-w-0 pr-2">
                                  <span className="font-semibold text-xs text-foreground truncate">{s.label}</span>
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${AUDIO_BADGE_COLORS[s.badge]}`}>{s.badge}</span>
                                </div>
                              ) : <SelectValue placeholder="Select STT Provider" />;
                            })()}
                          </SelectTrigger>
                          <SelectContent className="rounded-lg shadow-xl border border-border p-1.5 w-[320px]">
                            {STT_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value} className="rounded-md py-2.5 px-3 cursor-pointer focus:bg-background pr-8">
                                <div className="flex flex-col gap-0.5 w-full">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-xs text-foreground">{opt.label}</span>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${AUDIO_BADGE_COLORS[opt.badge]}`}>{opt.badge}</span>
                                  </div>
                                  <span className="text-[10px] text-muted-foreground leading-tight">{opt.description}</span>
                                  {opt.free && <span className="text-[9px] text-green-700 font-semibold mt-0.5">Free: {opt.free}</span>}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-semibold text-gray-400 whitespace-nowrap">STT Model / Version</Label>
                        <Select value={config.sttProvider === "DEEPGRAM" ? "nova-3" : "latest"} disabled>
                          <SelectTrigger className="rounded-md border border-input bg-card shadow-sm h-10 opacity-70 cursor-not-allowed">
                            <span className="font-semibold text-xs text-muted-foreground">
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
                      <Label htmlFor="firstMessage" className="text-[11px] font-semibold text-muted-foreground">First Message / Greeting</Label>
                      <Input id="firstMessage" value={config.firstMessage} onChange={(e) => update("firstMessage", e.target.value)} className="rounded-md border border-input bg-card shadow-sm h-9 text-xs focus-visible:border-brand-green focus-visible:ring-brand-green/20" placeholder="Hello! How can I help you today?" />
                    </div>
                  </div>

                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Knowledge Bases */}
        <TabsContent value="knowledge" className="space-y-6 mt-0">
          <div>
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Database className="h-5 w-5 text-brand-green" /> Knowledge Bases
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Sources this agent can retrieve answers from. Click a knowledge base to manage its files, or create a new one.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 max-w-4xl">
            {linkedKbs.map((kb) => (
              <div
                key={kb.id}
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/workspace/${workspaceId}/agents/${agentId}/knowledge-base/${kb.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(`/workspace/${workspaceId}/agents/${agentId}/knowledge-base/${kb.id}`);
                  }
                }}
                className="group relative text-left rounded-lg border border-border/60 bg-card p-5 hover:bg-brand-green hover:border-brand-green hover:shadow-md transition-all h-44 flex flex-col justify-between cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      type="button"
                      aria-label={`Delete ${kb.name}`}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute top-3 right-3 h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:text-white/70 hover:!text-white hover:!bg-white/20 transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-lg border-0 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-foreground">Delete knowledge base?</AlertDialogTitle>
                      <AlertDialogDescription className="text-muted-foreground">
                        This permanently deletes "{kb.name}" and all its data sources and indexed chunks. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-lg border-border">Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteKb(kb.id)} className="rounded-lg bg-destructive text-white hover:bg-red-700">
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-brand-green transition-colors group-hover:bg-white/20 group-hover:text-white">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground truncate transition-colors group-hover:text-white">{kb.name}</p>
                  <div className="relative h-8 mt-1">
                    <p className="absolute inset-0 flex items-center text-[11px] text-muted-foreground transition-opacity group-hover:opacity-0 group-hover:text-white/80">
                      {kb.visibility === "WORKSPACE" ? "Workspace-wide" : "Agent-specific"}
                    </p>
                    <div
                      className="absolute inset-0 flex items-center opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Select value={kb.visibility} onValueChange={(v) => handleChangeKbVisibility(kb.id, v as KnowledgeBaseVisibility)}>
                        <SelectTrigger className="h-8 text-[11px] rounded-md bg-white/15 border-white/30 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AGENT">Agent-specific</SelectItem>
                          <SelectItem value="WORKSPACE">Workspace-wide</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => setOpenCreateKb(true)}
              className="rounded-lg border-2 border-dashed border-border hover:border-brand-green hover:bg-brand-green transition-all h-44 flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <Plus className="h-6 w-6" />
              <span className="text-xs font-medium">Create Knowledge Base</span>
            </button>
          </div>

          {attachableKbs.length > 0 && (
            <Card className="shadow-sm border border-border/60 rounded-lg bg-card max-w-3xl">
              <CardHeader className="pb-3 border-b border-gray-100">
                <CardTitle className="text-sm font-semibold text-foreground">Other workspace knowledge bases</CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-1">
                  Workspace-wide knowledge bases created by other agents. Attach to give this agent access too.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-2">
                  {attachableKbs.map((kb) => (
                    <label key={kb.id} className="flex items-center justify-between rounded-lg border border-gray-150 p-3 cursor-pointer hover:bg-background transition-colors">
                      <span className="text-xs font-medium text-gray-700">{kb.name}</span>
                      <Switch
                        checked={config.knowledgeBaseIds.includes(kb.id)}
                        onCheckedChange={() => toggleInArray("knowledgeBaseIds", kb.id)}
                      />
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab 3: Functional Tools */}
        <TabsContent value="tools" className="space-y-6">
          <Card className="shadow-sm border border-border/60 rounded-lg bg-card max-w-3xl">
            <CardHeader className="pb-3 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-brand-green" /> Intents
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-1">
                  Group tools + prompt guidance under a named intent (e.g. "Booking", "Support") — attaching one turns on all its tools at once.
                </CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={() => setOpenCreateIntent(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> New Intent
              </Button>
            </CardHeader>
            <CardContent className="pt-5">
              {intents.length === 0 ? (
                <p className="text-xs text-gray-400">No intents yet.</p>
              ) : (
                <div className="space-y-2">
                  {intents.map((intent) => (
                    <div key={intent.id} className="flex items-center justify-between rounded-lg border border-gray-150 p-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-semibold text-gray-700">{intent.name}</span>
                        {intent.description && <span className="text-[11px] text-gray-400">{intent.description}</span>}
                        <span className="text-[9px] text-gray-400 font-mono">{intent.tools.length} tool{intent.tools.length === 1 ? "" : "s"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={config.intentIds.includes(intent.id)}
                          onCheckedChange={() => toggleIntent(intent)}
                        />
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteIntent(intent.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border border-border/60 rounded-lg bg-card max-w-3xl">
            <CardHeader className="pb-3 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-brand-green" /> Functional Tools
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-1">Configure functional capabilities this agent can invoke.</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={() => setOpenCreateTool(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Create Tool
              </Button>
            </CardHeader>
            <CardContent className="pt-5">
              {tools.length === 0 ? (
                <p className="text-xs text-gray-400">No workspace tools configured.</p>
              ) : (
                <div className="space-y-2">
                  {tools.map((tool) => (
                    <div key={tool.id} className="flex items-center justify-between rounded-lg border border-gray-150 p-3 hover:bg-background transition-colors">
                      <label className="flex flex-col cursor-pointer flex-1">
                        <span className="text-xs font-semibold text-gray-700">{tool.name}</span>
                        <span className="text-[9px] text-gray-400 font-mono mt-0.5">
                          {tool.type}
                          {tool.requiresConfirmation ? " · confirm before running" : ""}
                          {tool.requiredSlots.length ? ` · needs: ${tool.requiredSlots.join(", ")}` : ""}
                        </span>
                      </label>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={config.toolIds.includes(tool.id)}
                          onCheckedChange={() => toggleInArray("toolIds", tool.id)}
                        />
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteTool(tool.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        </div>
      </Tabs>

      <Dialog open={openCreateIntent} onOpenChange={(open) => { setOpenCreateIntent(open); if (!open) resetCreateIntentForm(); }}>
        <DialogContent className="rounded-lg border-0 shadow-2xl sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">New Intent</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              A named grouping of tools + prompt guidance — turns on together when attached.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input value={newIntentName} onChange={(e) => setNewIntentName(e.target.value)} placeholder="Booking" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Input value={newIntentDescription} onChange={(e) => setNewIntentDescription(e.target.value)} placeholder="Handles checking and creating bookings" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Prompt guidance (optional)</Label>
              <Textarea
                value={newIntentPromptSnippet}
                onChange={(e) => setNewIntentPromptSnippet(e.target.value)}
                placeholder="When the caller wants to book, always confirm date/time/service before calling a tool."
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tools in this intent</Label>
              {tools.length === 0 ? (
                <p className="text-xs text-gray-400">Create a tool first.</p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto border border-border rounded-md p-2">
                  {tools.map((tool) => (
                    <label key={tool.id} className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newIntentToolIds.includes(tool.id)}
                        onChange={() => toggleNewIntentTool(tool.id)}
                      />
                      {tool.name}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenCreateIntent(false)}>Cancel</Button>
            <Button onClick={handleCreateIntent} disabled={creatingIntent || !newIntentName.trim()}>
              {creatingIntent ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openCreateTool} onOpenChange={(open) => { setOpenCreateTool(open); if (!open) resetCreateToolForm(); }}>
        <DialogContent className="rounded-lg border-0 shadow-2xl sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">Create Tool</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Define a function the agent's LLM can call — an HTTP request or an n8n workflow.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Name</Label>
                <Input value={newToolName} onChange={(e) => setNewToolName(e.target.value)} placeholder="check_availability" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Type</Label>
                <Select value={newToolType} onValueChange={(v) => setNewToolType(v as CreatableToolType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="http.get">HTTP GET</SelectItem>
                    <SelectItem value="http.post">HTTP POST</SelectItem>
                    <SelectItem value="n8n.webhook">n8n Webhook</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description (what the LLM sees)</Label>
              <Textarea
                value={newToolDescription}
                onChange={(e) => setNewToolDescription(e.target.value)}
                placeholder="Checks whether a given date/time is available for booking."
                rows={2}
              />
            </div>

            {newToolType === "n8n.webhook" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Workflow ID (optional)</Label>
                  <Input value={newToolWorkflowId} onChange={(e) => setNewToolWorkflowId(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Webhook URL</Label>
                  <Input value={newToolWebhookUrl} onChange={(e) => setNewToolWebhookUrl(e.target.value)} placeholder="https://n8n.example.com/webhook/..." />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">URL</Label>
                  <Input value={newToolUrl} onChange={(e) => setNewToolUrl(e.target.value)} placeholder="https://api.example.com/bookings" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Method</Label>
                  <Select value={newToolMethod} onValueChange={(v) => setNewToolMethod(v as "GET" | "POST")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GET">GET</SelectItem>
                      <SelectItem value="POST">POST</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Parameters the LLM must provide</Label>
                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={addToolParam}>
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              </div>
              {newToolParams.length === 0 ? (
                <p className="text-xs text-gray-400">No parameters — the LLM will call this with no arguments.</p>
              ) : (
                <div className="space-y-2">
                  {newToolParams.map((p, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        className="h-8 text-xs flex-1"
                        placeholder="name"
                        value={p.name}
                        onChange={(e) => updateToolParam(i, { name: e.target.value })}
                      />
                      <Select value={p.type} onValueChange={(v) => updateToolParam(i, { type: v })}>
                        <SelectTrigger className="h-8 text-xs w-24"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="string">string</SelectItem>
                          <SelectItem value="number">number</SelectItem>
                          <SelectItem value="boolean">boolean</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        className="h-8 text-xs flex-1"
                        placeholder="description"
                        value={p.description}
                        onChange={(e) => updateToolParam(i, { description: e.target.value })}
                      />
                      <label className="flex items-center gap-1 text-[10px] text-gray-500 whitespace-nowrap">
                        <input type="checkbox" checked={p.required} onChange={(e) => updateToolParam(i, { required: e.target.checked })} />
                        required
                      </label>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeToolParam(i)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={newToolRequiresConfirmation}
                  onChange={(e) => setNewToolRequiresConfirmation(e.target.checked)}
                />
                Requires confirmation before running (for side-effecting actions like creating a booking)
              </label>
              <div className="space-y-1.5">
                <Label className="text-xs">Required info before calling (comma-separated)</Label>
                <Input
                  value={newToolRequiredSlots}
                  onChange={(e) => setNewToolRequiredSlots(e.target.value)}
                  placeholder="date, time, service"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenCreateTool(false)}>Cancel</Button>
            <Button onClick={handleCreateTool} disabled={creatingTool || !newToolName.trim()}>
              {creatingTool ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openCreateKb} onOpenChange={setOpenCreateKb}>
        <DialogContent className="rounded-lg border-0 shadow-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Create Knowledge Base</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Give it a name and choose who can use it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="newKbName" className="text-[11px] font-semibold text-muted-foreground">Name</Label>
              <Input
                id="newKbName"
                autoFocus
                value={newKbName}
                onChange={(e) => setNewKbName(e.target.value)}
                placeholder="e.g. Product FAQs"
                className="rounded-md border-border h-10"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newKbName.trim() && !creatingKb) handleCreateKb();
                }}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] font-semibold text-muted-foreground">Visibility</Label>
              <RadioGroup value={newKbVisibility} onValueChange={(v) => setNewKbVisibility(v as KnowledgeBaseVisibility)}>
                <label className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-background transition-colors has-[[data-state=checked]]:border-brand-green has-[[data-state=checked]]:bg-accent">
                  <RadioGroupItem value="AGENT" id="vis-agent" className="mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-foreground">Agent-specific</p>
                    <p className="text-[11px] text-muted-foreground">Only this agent can use it.</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-background transition-colors has-[[data-state=checked]]:border-brand-green has-[[data-state=checked]]:bg-accent">
                  <RadioGroupItem value="WORKSPACE" id="vis-workspace" className="mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-foreground">Workspace-wide</p>
                    <p className="text-[11px] text-muted-foreground">Any agent in this workspace can attach it.</p>
                  </div>
                </label>
              </RadioGroup>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-md border-border" onClick={() => setOpenCreateKb(false)} disabled={creatingKb}>
              Cancel
            </Button>
            <Button
              className="rounded-md bg-brand-green hover:bg-brand-green/90 text-white"
              onClick={handleCreateKb}
              disabled={!newKbName.trim() || creatingKb}
            >
              {creatingKb ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

