"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@libs/shadcn-ui/components/ui/card";
import { Button } from "@libs/shadcn-ui/components/ui/button";
import { Switch } from "@libs/shadcn-ui/components/ui/switch";
import { Label } from "@libs/shadcn-ui/components/ui/label";
import { Input } from "@libs/shadcn-ui/components/ui/input";
import { Slider } from "@libs/shadcn-ui/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@libs/shadcn-ui/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@libs/shadcn-ui/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@libs/shadcn-ui/components/ui/dialog";
import { Textarea } from "@libs/shadcn-ui/components/ui/textarea";
import { toast } from "@libs/shadcn-ui/components/ui/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@libs/shadcn-ui/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@libs/shadcn-ui/components/ui/command";

type LlmProvider = "openai" | "anthropic" | "google" | "groq" | "grok";

interface BehaviourSettings {
  globalNoMatchMessage: string;
  globalNoReplyEnabled: boolean;
  maxTurns: number; // in turns
  llmFallback: Partial<Record<LlmProvider, string>>; // model name per provider
  globalNoMatchMode: "generative" | "scripted";
  genModel: string;
  genTemperature: number;
  genMaxTokens: number;
  genSystem: string;
  scriptedMessage: string;
  messageDelayMs: number;
  // Voice (output)
  voiceOutputProvider: string;
  voiceOutputVoice: string;
  voiceOutputModel: string;
  backgroundAudio: string;
  audioCue: string;
  talkingSpeed: number; // 0.5 - 1.5
  stability: number; // 0 - 1
  similarityBoost: number; // 0 - 1
  // Voice (input)
  voiceInputProvider: string;
  voiceInputModel: string;
  voiceInputLanguage: string;
  voiceInputKeywords: string;
  recognitionBalance: number; // 0 speed, 1 balanced, 2 accuracy
  webhookUrl: string;
  recognitionMode: "simplified" | "advanced";
  onPunctuationSec: number;
  onNoPunctuationSec: number;
  interruptionThresholdWords: number;
  endpointingMs: number;
  // Provider API keys (stored locally only)
  elevenLabsApiKey: string;
}

const DEFAULTS: BehaviourSettings = {
  globalNoMatchMessage: "I couldn't find a suitable answer to that. Could you rephrase or provide more details?",
  globalNoReplyEnabled: false,
  maxTurns: 10,
  llmFallback: {},
  globalNoMatchMode: "generative",
  genModel: "claude-3.5-sonnet",
  genTemperature: 0.7,
  genMaxTokens: 5000,
  genSystem: "You are a helpful AI assistant. If you don't know the answer, say so clearly and offer alternatives.",
  scriptedMessage: "Sorry, I don’t know that one. I can help answer questions or complete tasks. Let me know if there’s something else you need help with.",
  messageDelayMs: 500,
  // Voice defaults
  voiceOutputProvider: "ElevenLabs",
  voiceOutputVoice: "Liam",
  voiceOutputModel: "Eleven turbo v2.5",
  backgroundAudio: "None",
  audioCue: "None",
  talkingSpeed: 1.0,
  stability: 0.7,
  similarityBoost: 0.7,
  voiceInputProvider: "Deepgram",
  voiceInputModel: "Nova-3",
  voiceInputLanguage: "English",
  voiceInputKeywords: "",
  recognitionBalance: 1,
  webhookUrl: "",
  recognitionMode: "simplified",
  onPunctuationSec: 0.2,
  onNoPunctuationSec: 1.0,
  interruptionThresholdWords: 1,
  endpointingMs: 10,
  elevenLabsApiKey: "",
};

const PROVIDERS: { key: LlmProvider; label: string; models: string[] }[] = [
  { key: "openai", label: "OpenAI", models: [
    "gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo", "o3", "o3-mini"
  ] },
  { key: "anthropic", label: "Anthropic", models: [
    "claude-3.7-sonnet", "claude-3.5-sonnet", "claude-3.5-haiku", "claude-3-opus"
  ] },
  { key: "google", label: "Google", models: [
    "gemini-2.0-flash", "gemini-2.0-pro", "gemini-1.5-pro", "gemini-1.5-flash"
  ] },
  { key: "groq", label: "Groq", models: [
    "llama-3.1-70b", "llama-3.1-8b", "mixtral-8x7b"
  ] },
  { key: "grok", label: "Grok", models: [
    "grok-2", "grok-2-mini", "grok-1"
  ] },
];

export default function BehaviourSettingsPage() {
  const params = useParams();
  const agentId = params?.agentId as string;
  const storageKey = useMemo(() => (agentId ? `agent:${agentId}:behaviour_settings` : undefined), [agentId]);

  const [settings, setSettings] = useState<BehaviourSettings>(DEFAULTS);
  const [editNoMatchOpen, setEditNoMatchOpen] = useState(false);
  const [noMatchDraft, setNoMatchDraft] = useState("");
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"general" | "chat" | "voice">("general");
  const [connectVoiceOpen, setConnectVoiceOpen] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState("");

  // Load
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as BehaviourSettings;
        setSettings({ ...DEFAULTS, ...parsed });
      }
    } catch (e) {
      console.warn("Failed to load behaviour settings", e);
    }
  }, [storageKey]);

  // Save helper
  const persist = (next: BehaviourSettings) => {
    setSettings(next);
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}
  };

  // Combined model options for Generative tab (sample list for UI only)
  const MODEL_OPTIONS: { id: string; label: string; provider: LlmProvider }[] = [
    // OpenAI
    { id: "gpt-4o", label: "GPT-4o", provider: "openai" },
    { id: "gpt-4o-mini", label: "GPT-4o mini", provider: "openai" },
    { id: "gpt-4.1", label: "GPT-4.1", provider: "openai" },
    { id: "gpt-4.1-mini", label: "GPT-4.1 mini", provider: "openai" },
    { id: "gpt-4-turbo", label: "GPT-4 Turbo", provider: "openai" },
    { id: "gpt-4", label: "GPT-4", provider: "openai" },
    { id: "gpt-3.5-turbo", label: "GPT-3.5 Turbo", provider: "openai" },
    { id: "o3", label: "o3", provider: "openai" },
    { id: "o3-mini", label: "o3 mini", provider: "openai" },
    // Anthropic
    { id: "claude-3.7-sonnet", label: "Claude 3.7 - Sonnet", provider: "anthropic" },
    { id: "claude-3.5-sonnet", label: "Claude 3.5 - Sonnet", provider: "anthropic" },
    { id: "claude-3.5-haiku", label: "Claude 3.5 - Haiku", provider: "anthropic" },
    { id: "claude-3-opus", label: "Claude 3 - Opus", provider: "anthropic" },
    // Google
    { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", provider: "google" },
    { id: "gemini-2.0-pro", label: "Gemini 2.0 Pro", provider: "google" },
    { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro", provider: "google" },
    { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash", provider: "google" },
    // Groq
    { id: "llama-3.1-70b", label: "Llama 3.1 70B", provider: "groq" },
    { id: "llama-3.1-8b", label: "Llama 3.1 8B", provider: "groq" },
    { id: "mixtral-8x7b", label: "Mixtral 8x7B", provider: "groq" },
    // Grok (xAI)
    { id: "grok-2", label: "Grok-2", provider: "grok" },
    { id: "grok-2-mini", label: "Grok-2 mini", provider: "grok" },
    { id: "grok-1", label: "Grok-1", provider: "grok" },
  ];

  // Lightweight inline SVG brand icons (no external deps)
  const BrandIcon = ({ provider }: { provider: LlmProvider }) => {
    switch (provider) {
      case "openai":
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden className="shrink-0">
            <circle cx="10" cy="10" r="10" fill="#10B981" />
            <path d="M6.5 10.5c0-2 1.7-3.5 3.5-3.5 1 0 1.9.4 2.6 1.1l-1.2 1.2c-.4-.3-.9-.5-1.4-.5-1.1 0-2 .9-2 2s.9 2 2 2c.5 0 1-.2 1.4-.5l1.2 1.2c-.7.7-1.6 1.1-2.6 1.1-2 0-3.5-1.6-3.5-3.5Z" fill="#fff" />
          </svg>
        );
      case "anthropic":
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden className="shrink-0">
            <rect width="20" height="20" rx="10" fill="#F59E0B" />
            <path d="M10 5l4 10h-2l-.8-2H8.8L8 15H6l4-10Zm0 3.2L9 11h2l-1-2.8Z" fill="#fff" />
          </svg>
        );
      case "google":
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden className="shrink-0">
            <circle cx="10" cy="10" r="10" fill="#EA4335" />
            <path d="M10 5c2.8 0 5 2.2 5 5 0 .3 0 .6-.1.9H10v-2h4c-.3-1.2-1.7-2.4-4-2.4-2.2 0-4 1.8-4 4s1.8 4 4 4c1.1 0 2-.4 2.7-1l1.4 1.4C13 16.1 11.7 16.6 10 16.6 6.9 16.6 4.4 14.1 4.4 11S6.9 5 10 5Z" fill="#fff" />
          </svg>
        );
      case "groq":
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden className="shrink-0">
            <rect width="20" height="20" rx="10" fill="#FB923C" />
            <path d="M6.5 10a3.5 3.5 0 1 1 3.5 3.5h-1V12h1c1 0 1.8-.8 1.8-1.8S10.9 8.4 10 8.4 8.2 9.2 8.2 10.2v3.3H6.5V10Z" fill="#fff" />
          </svg>
        );
      case "grok":
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden className="shrink-0">
            <rect width="20" height="20" rx="10" fill="#6366F1" />
            <path d="M6 10a4 4 0 1 1 8 0v3h-2v-3a2 2 0 1 0-4 0v3H6v-3Z" fill="#fff" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (<div className="w-full px-6 pb-10 pt-6">
      <h1 className="text-2xl font-semibold mb-4">Behaviour</h1>

      {/* Behaviour Tabs: only General active for now */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="mb-4">
        <TabsList className="bg-gray-100">
          <TabsTrigger value="general" className="data-[state=active]:bg-white data-[state=active]:shadow">General</TabsTrigger>
          <TabsTrigger value="chat" className="data-[state=active]:bg-white data-[state=active]:shadow">Chat</TabsTrigger>
          <TabsTrigger value="voice" className="data-[state=active]:bg-white data-[state=active]:shadow">Voice</TabsTrigger>
        </TabsList>
      </Tabs>
      {activeTab === "general" && (
      <div className="max-w-3xl space-y-3">
      {/* Global no match */}
      <Card className="mb-3 border-gray-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between py-4">
          <div>
            <CardTitle>Global no match</CardTitle>
            <CardDescription>How to respond if the user query doesn’t match any trigger or KB sources.</CardDescription>
          </div>
          <Button variant="secondary" size="sm" onClick={() => { setNoMatchDraft(settings.globalNoMatchMessage); setEditNoMatchOpen(true); }}>Edit</Button>
        </CardHeader>
      </Card>

      {/* Global no reply */}
      <Card className="mb-3 border-gray-200 shadow-sm">
        <CardHeader className="py-4">
          <CardTitle>Global no reply</CardTitle>
          <CardDescription>How to respond if the user says nothing for 10s.</CardDescription>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Toggle automatic handling for no-reply scenarios.</div>
            <Switch
              checked={settings.globalNoReplyEnabled}
              onCheckedChange={(v) => persist({ ...settings, globalNoReplyEnabled: v })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Max turns saved to memory */}
      <Card className="mb-3 border-gray-200 shadow-sm">
        <CardHeader className="py-4">
          <CardTitle>Max. number of turns saved to memory</CardTitle>
          <CardDescription>
            Number of conversation history turns stored in memory. Higher values provide more context but will increase latency and token usage.
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>{settings.maxTurns} turns</span>
              <span className="inline-flex items-center justify-center h-7 px-2 rounded-md bg-gray-100 text-gray-700 font-medium">{settings.maxTurns}</span>
            </div>
            <Slider
              value={[settings.maxTurns]}
              onValueChange={([v]) => persist({ ...settings, maxTurns: v })}
              min={10}
              max={100}
              step={1}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>10 turns</span>
              <span>100 turns</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* LLM model fallback */}
      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="py-4">
          <CardTitle>LLM model fallback</CardTitle>
          <CardDescription>Automatically switch to a different language model provider during outages.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 pb-4">
          {PROVIDERS.map((p) => (
            <div key={p.key} className="flex items-center gap-3 py-1">
              <div className="w-40 flex items-center gap-2 text-sm font-medium">
                <BrandIcon provider={p.key} />
                {p.label}
              </div>
              <div className="flex-1">
                <Select
                  value={settings.llmFallback[p.key] || ""}
                  onValueChange={(val) => {
                    const next = { ...settings, llmFallback: { ...settings.llmFallback, [p.key]: val } };
                    persist(next);
                    toast({ title: "Saved", description: `${p.label} fallback set to ${val}` });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select fallback model" />
                  </SelectTrigger>
                  <SelectContent>
                    {p.models.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Edit dialog for Global no match */}
      </div>
      )}

      {activeTab === "chat" && (
        <div className="max-w-md">
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="py-4">
              <CardTitle>Message delay</CardTitle>
              <CardDescription>The default time delay (ms) between your agent's responses.</CardDescription>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={50}
                  className="w-32"
                  value={String(settings.messageDelayMs)}
                  onChange={(e) => {
                    const v = Math.max(0, parseInt(e.target.value || "0", 10));
                    persist({ ...settings, messageDelayMs: v });
                  }}
                />
                <span className="text-sm text-muted-foreground">ms</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      {activeTab === "voice" && (
        <div className="max-w-3xl space-y-3">
          {/* Voice output */}
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="py-4">
              <CardTitle>Voice output</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pb-4">
              <div>
                <Label className="text-sm">Provider</Label>
                <Select value={settings.voiceOutputProvider} onValueChange={(v)=>persist({...settings, voiceOutputProvider:v})}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select provider"/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ElevenLabs">Eleven Labs</SelectItem>
                    <SelectItem value="Rime">Rime</SelectItem>
                    <SelectItem value="Cartesia">Cartesia</SelectItem>
                    <SelectItem value="Google">Google</SelectItem>
                    <SelectItem value="Amazon">Amazon</SelectItem>
                    <SelectItem value="Microsoft">Microsoft</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">Voice</Label>
                <Select value={settings.voiceOutputVoice} onValueChange={(v)=>persist({...settings, voiceOutputVoice:v})}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select voice"/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Liam">Liam</SelectItem>
                    <SelectItem value="Charlotte">Charlotte</SelectItem>
                    <SelectItem value="Adam">Adam</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Custom voice connect */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-medium">Custom voice</div>
                  <div className="text-xs text-muted-foreground">Add your own custom voiceID from Eleven Labs.</div>
                </div>
                <div className="flex items-center gap-2">
                  {settings.elevenLabsApiKey ? (
                    <>
                      <span className="rounded-md bg-emerald-50 text-emerald-700 text-xs px-2 py-1">Connected</span>
                      <Button variant="secondary" size="sm" onClick={() => { setApiKeyDraft(settings.elevenLabsApiKey); setConnectVoiceOpen(true); }}>Manage</Button>
                    </>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={() => { setApiKeyDraft(""); setConnectVoiceOpen(true); }}>Connect</Button>
                  )}
                </div>
              </div>
              <div>
                <Label className="text-sm">Model</Label>
                <Select value={settings.voiceOutputModel} onValueChange={(v)=>persist({...settings, voiceOutputModel:v})}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select model"/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Eleven flash v2.5">Eleven flash v2.5</SelectItem>
                    <SelectItem value="Eleven turbo v2.5">Eleven turbo v2.5</SelectItem>
                    <SelectItem value="Eleven multilingual v2">Eleven multilingual v2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Background & audio cue */}
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="py-4">
              <CardTitle>Background audio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pb-4">
              <div>
                <Label className="text-sm">Background audio</Label>
                <Select value={settings.backgroundAudio} onValueChange={(v)=>persist({...settings, backgroundAudio:v})}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select background"/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="None">None</SelectItem>
                    <SelectItem value="Office busy">Office busy</SelectItem>
                    <SelectItem value="Office quiet">Office quiet</SelectItem>
                    <SelectItem value="Call center">Call center</SelectItem>
                    <SelectItem value="Coffee shop">Coffee shop</SelectItem>
                    <SelectItem value="White noise">White noise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">Audio cue</Label>
                <Select value={settings.audioCue} onValueChange={(v)=>persist({...settings, audioCue:v})}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select cue"/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="None">None</SelectItem>
                    <SelectItem value="Sound 1">Sound 1</SelectItem>
                    <SelectItem value="Sound 2">Sound 2</SelectItem>
                    <SelectItem value="Sound 3">Sound 3</SelectItem>
                    <SelectItem value="Sound 4">Sound 4</SelectItem>
                    <SelectItem value="Sound 5">Sound 5</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Sliders */}
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="py-4">
              <CardTitle>Talking speed</CardTitle>
              <CardDescription>Adjusts the speed of the voice as it talks to the user.</CardDescription>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{settings.talkingSpeed.toFixed(2)}</span>
                </div>
                <Slider value={[Math.round(settings.talkingSpeed*100)]} min={50} max={150} step={1} onValueChange={([v])=>persist({...settings, talkingSpeed: v/100})}/>
                <div className="flex items-center justify-between text-xs text-muted-foreground"><span>0.5</span><span>1.5</span></div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="py-4">
              <CardTitle>Stability</CardTitle>
              <CardDescription>Higher stability is more consistent but may sound monotone.</CardDescription>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="space-y-2">
                <span className="text-sm text-muted-foreground">{settings.stability.toFixed(2)}</span>
                <Slider value={[Math.round(settings.stability*100)]} min={0} max={100} step={1} onValueChange={([v])=>persist({...settings, stability: v/100})}/>
                <div className="flex items-center justify-between text-xs text-muted-foreground"><span>0</span><span>1</span></div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="py-4">
              <CardTitle>Similarity boost</CardTitle>
              <CardDescription>How closely the AI should adhere to the original voice when replicating it.</CardDescription>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="space-y-2">
                <span className="text-sm text-muted-foreground">{settings.similarityBoost.toFixed(2)}</span>
                <Slider value={[Math.round(settings.similarityBoost*100)]} min={0} max={100} step={1} onValueChange={([v])=>persist({...settings, similarityBoost: v/100})}/>
                <div className="flex items-center justify-between text-xs text-muted-foreground"><span>0</span><span>1</span></div>
              </div>
            </CardContent>
          </Card>

          {/* Voice input */}
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="py-4">
              <CardTitle>Voice input</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pb-4">
              <div>
                <Label className="text-sm">Provider</Label>
                <Select value={settings.voiceInputProvider} onValueChange={(v)=>persist({...settings, voiceInputProvider:v})}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select provider"/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Deepgram">Deepgram</SelectItem>
                    <SelectItem value="Cartesia">Cartesia</SelectItem>
                    <SelectItem value="AssemblyAI">AssemblyAI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">Model</Label>
                <Select value={settings.voiceInputModel} onValueChange={(v)=>persist({...settings, voiceInputModel:v})}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select model"/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Nova-3">Nova-3</SelectItem>
                    <SelectItem value="Nova-3 Medical">Nova-3 Medical</SelectItem>
                    <SelectItem value="Nova-2">Nova-2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">Language</Label>
                <Select value={settings.voiceInputLanguage} onValueChange={(v)=>persist({...settings, voiceInputLanguage:v})}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select language"/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="English">English</SelectItem>
                    <SelectItem value="Multilingual">Multilingual (EN, ES, FR, DE, HI, RU, PT, JA, IT, NL)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">Keywords</Label>
                <Input className="mt-1" placeholder="Enter keywords, separated by commas" value={settings.voiceInputKeywords} onChange={(e)=>persist({...settings, voiceInputKeywords:e.target.value})}/>
              </div>
            </CardContent>
          </Card>

          {/* Recognition settings */}
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="py-4">
              <CardTitle>Recognition accuracy vs. response speed</CardTitle>
              <CardDescription>Adjust the balance or fine-tune advanced timings.</CardDescription>
            </CardHeader>
            <CardContent className="pb-4">
              <Tabs value={settings.recognitionMode} onValueChange={(v)=>persist({...settings, recognitionMode: v as any})}>
                <TabsList className="mb-3">
                  <TabsTrigger value="simplified">Simplified</TabsTrigger>
                  <TabsTrigger value="advanced">Advanced</TabsTrigger>
                </TabsList>
                <TabsContent value="simplified">
                  <Slider value={[settings.recognitionBalance]} min={0} max={2} step={1} onValueChange={([v])=>persist({...settings, recognitionBalance:v})}/>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                    <span>Speed</span>
                    <span>Balanced</span>
                    <span>Accuracy</span>
                  </div>
                </TabsContent>
                <TabsContent value="advanced" className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">On punctuation, sec.</Label>
                      <span className="text-sm text-muted-foreground">{settings.onPunctuationSec.toFixed(2)}</span>
                    </div>
                    <Slider value={[Math.round(settings.onPunctuationSec*100)]} min={0} max={300} step={5} onValueChange={([v])=>persist({...settings, onPunctuationSec: v/100})}/>
                    <div className="flex items-center justify-between text-xs text-muted-foreground"><span>0 seconds</span><span>3 seconds</span></div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">On no punctuation, sec.</Label>
                      <span className="text-sm text-muted-foreground">{settings.onNoPunctuationSec.toFixed(2)}</span>
                    </div>
                    <Slider value={[Math.round(settings.onNoPunctuationSec*100)]} min={100} max={1000} step={5} onValueChange={([v])=>persist({...settings, onNoPunctuationSec: v/100})}/>
                    <div className="flex items-center justify-between text-xs text-muted-foreground"><span>1 second</span><span>10 seconds</span></div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Interruption threshold</Label>
                      <span className="text-sm text-muted-foreground">{settings.interruptionThresholdWords} words</span>
                    </div>
                    <Slider value={[settings.interruptionThresholdWords]} min={1} max={5} step={1} onValueChange={([v])=>persist({...settings, interruptionThresholdWords: v})}/>
                    <div className="flex items-center justify-between text-xs text-muted-foreground"><span>1 word</span><span>5 words</span></div>
                  </div>
                  <div>
                    <Label className="text-sm">Endpointing</Label>
                    <div className="mt-1 flex items-center gap-2">
                      <Input className="w-24" inputMode="numeric" type="number" min={0} step={1} value={String(settings.endpointingMs)} onChange={(e)=>{
                        const v = Math.max(0, parseInt(e.target.value||"0",10));
                        persist({...settings, endpointingMs: v});
                      }}/>
                      <span className="text-xs text-muted-foreground">MS</span>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Webhook */}
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="py-4">
              <CardTitle>Call events webhook</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <Input placeholder="Enter endpoint URL" value={settings.webhookUrl} onChange={(e)=>persist({...settings, webhookUrl:e.target.value})}/>
            </CardContent>
          </Card>
        </div>
      )}
      <Dialog open={editNoMatchOpen} onOpenChange={setEditNoMatchOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Global no match</DialogTitle>
          </DialogHeader>
          <Tabs value={settings.globalNoMatchMode || "generative"} onValueChange={(v) => persist({ ...settings, globalNoMatchMode: v as any })}>
            <TabsList className="mb-2">
              <TabsTrigger value="generative">Generative</TabsTrigger>
              <TabsTrigger value="scripted">Scripted</TabsTrigger>
            </TabsList>
            <TabsContent value="generative" className="space-y-4">
              <div>
                <div className="text-xs uppercase text-muted-foreground mb-2">Overrides</div>
                <Label className="text-sm">AI model</Label>
                <div className="mt-1">
                  <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" aria-expanded={comboboxOpen} className="w-full justify-between">
                        <div className="flex items-center gap-2">
                          <BrandIcon provider={(MODEL_OPTIONS.find(m => m.id === (settings.genModel || DEFAULTS.genModel))?.provider || "openai") as LlmProvider} />
                          <span className="truncate">{MODEL_OPTIONS.find(m => m.id === (settings.genModel || DEFAULTS.genModel))?.label || "Select model"}</span>
                        </div>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-[320px]">
                      <Command>
                        <CommandInput placeholder="Search" />
                        <CommandEmpty>No model found.</CommandEmpty>
                        <CommandList>
                          <CommandGroup>
                            {MODEL_OPTIONS.map((m) => (
                              <CommandItem key={m.id} onSelect={() => { persist({ ...settings, genModel: m.id }); setComboboxOpen(false); }}>
                                <BrandIcon provider={m.provider} />
                                <span>{m.label}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Temperature</Label>
                  <span className="text-sm text-muted-foreground">{(settings.genTemperature ?? DEFAULTS.genTemperature)?.toFixed(1)}</span>
                </div>
                <Slider value={[Math.round(((settings.genTemperature ?? DEFAULTS.genTemperature) * 10))]} min={0} max={10} step={1} onValueChange={([v]) => persist({ ...settings, genTemperature: v / 10 })} />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Deterministic</span>
                  <span>Random</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Max tokens</Label>
                  <span className="inline-flex items-center justify-center h-6 px-2 rounded-md bg-gray-100 text-gray-700 text-xs font-medium">{settings.genMaxTokens ?? DEFAULTS.genMaxTokens}</span>
                </div>
                <Slider value={[settings.genMaxTokens ?? DEFAULTS.genMaxTokens]} min={10} max={24000} step={10} onValueChange={([v]) => persist({ ...settings, genMaxTokens: v })} />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>10</span>
                  <span>24000</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">System</Label>
                <Textarea rows={4} value={settings.genSystem ?? DEFAULTS.genSystem} onChange={(e) => persist({ ...settings, genSystem: e.target.value })} />
              </div>
            </TabsContent>
            <TabsContent value="scripted" className="space-y-2">
              <Label className="text-sm">Message</Label>
              <Textarea rows={6} value={settings.scriptedMessage ?? DEFAULTS.scriptedMessage} onChange={(e) => persist({ ...settings, scriptedMessage: e.target.value })} />
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditNoMatchOpen(false)}>Cancel</Button>
            <Button onClick={() => { setEditNoMatchOpen(false); toast({ title: "Saved", description: "Global no match updated." }); }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Connect Custom Voice (Eleven Labs) */}
      <Dialog open={connectVoiceOpen} onOpenChange={setConnectVoiceOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect to {settings.voiceOutputProvider === "ElevenLabs" ? "Eleven Labs" : settings.voiceOutputProvider}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-sm">API key</Label>
            <Input type="password" placeholder="Enter API key" value={apiKeyDraft} onChange={(e)=>setApiKeyDraft(e.target.value)} />
          </div>
          <DialogFooter>
            {settings.elevenLabsApiKey && (
              <Button variant="outline" onClick={()=>{ persist({ ...settings, elevenLabsApiKey: "" }); setConnectVoiceOpen(false); toast({ title: "Disconnected", description: "Eleven Labs disconnected."}); }}>Remove</Button>
            )}
            <Button onClick={()=>{ persist({ ...settings, elevenLabsApiKey: apiKeyDraft.trim() }); setConnectVoiceOpen(false); toast({ title: "Saved", description: "API key stored locally."}); }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
