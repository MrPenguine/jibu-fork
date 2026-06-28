"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  getAgentConfig,
  updateAgentConfig,
  listAgentTools,
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
import { toast } from "@libs/shadcn-ui/components/ui/use-toast";

const PROVIDERS = [
  { value: "google", label: "Google (Gemini)" },
  { value: "xai", label: "xAI (Grok)" },
  { value: "mistral", label: "Mistral" },
];

const MODELS: Record<string, string[]> = {
  google: ["gemini-flash-latest", "gemini-1.5-pro", "gemini-1.5-flash"],
  xai: ["grok-3-latest", "grok-2-latest"],
  mistral: ["mistral-large-latest", "mistral-small-latest"],
};

const TTS_PROVIDERS = ["ELEVENLABS", "AZURE", "OPENAI"];
const STT_PROVIDERS = ["DEEPGRAM", "WHISPER", "AZURE", "GOOGLE"];

export default function AgentConfigPage() {
  const params = useParams();
  const agentId = params.agentId as string;

  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [tools, setTools] = useState<WorkspaceTool[]>([]);
  const [kbs, setKbs] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
      } catch (e) {
        toast({ title: "Failed to load agent config", description: String(e), variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    if (agentId) load();
  }, [agentId]);

  const update = <K extends keyof AgentConfig>(key: K, value: AgentConfig[K]) => {
    setConfig((prev) => (prev ? { ...prev, [key]: value } : prev));
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
      <div className="max-w-3xl mx-auto p-8 space-y-4">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const modelOptions = MODELS[config.provider] || [];

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Configure Agent</h1>
          <p className="text-sm text-gray-500">Define this agent with a prompt, model, knowledge and tools — no canvas required.</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="bg-[#009959] hover:bg-[#007d49]">
          {saving ? "Saving..." : "Save changes"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Basics</CardTitle>
          <CardDescription>Name and description.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={config.name} onChange={(e) => update("name", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input id="description" value={config.description} onChange={(e) => update("description", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Brain</CardTitle>
          <CardDescription>System prompt, provider and model.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="systemPrompt">System prompt</Label>
            <Textarea
              id="systemPrompt"
              rows={6}
              value={config.systemPrompt}
              onChange={(e) => update("systemPrompt", e.target.value)}
              placeholder="You are a helpful assistant..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value={config.provider} onValueChange={(v) => update("provider", v)}>
                <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              <Select value={config.model} onValueChange={(v) => update("model", v)}>
                <SelectTrigger><SelectValue placeholder="Select model" /></SelectTrigger>
                <SelectContent>
                  {modelOptions.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Knowledge bases</CardTitle>
          <CardDescription>RAG sources searched on every turn.</CardDescription>
        </CardHeader>
        <CardContent>
          {kbs.length === 0 ? (
            <p className="text-sm text-gray-500">No knowledge bases in this workspace.</p>
          ) : (
            <div className="space-y-2">
              {kbs.map((kb) => (
                <label key={kb.id} className="flex items-center justify-between rounded-md border p-3 cursor-pointer">
                  <span className="text-sm text-gray-800">{kb.name}</span>
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

      <Card>
        <CardHeader>
          <CardTitle>Tools</CardTitle>
          <CardDescription>Functions the agent can call.</CardDescription>
        </CardHeader>
        <CardContent>
          {tools.length === 0 ? (
            <p className="text-sm text-gray-500">No tools in this workspace.</p>
          ) : (
            <div className="space-y-2">
              {tools.map((tool) => (
                <label key={tool.id} className="flex items-center justify-between rounded-md border p-3 cursor-pointer">
                  <span className="text-sm text-gray-800">
                    {tool.name}
                    <span className="ml-2 text-xs text-gray-400">{tool.type}</span>
                  </span>
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

      <Card>
        <CardHeader>
          <CardTitle>Channels</CardTitle>
          <CardDescription>Where this agent is reachable.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(["chat", "whatsapp", "voice"] as const).map((ch) => (
            <div key={ch} className="flex items-center justify-between">
              <Label className="capitalize">{ch === "chat" ? "Web chat" : ch}</Label>
              <Switch
                checked={config.channels[ch]}
                onCheckedChange={(v) => update("channels", { ...config.channels, [ch]: v })}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {config.channels.voice && (
        <Card>
          <CardHeader>
            <CardTitle>Voice settings</CardTitle>
            <CardDescription>STT/TTS providers and greeting (voice channel).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>STT provider</Label>
                <Select value={config.sttProvider} onValueChange={(v) => update("sttProvider", v)}>
                  <SelectTrigger><SelectValue placeholder="Select STT" /></SelectTrigger>
                  <SelectContent>
                    {STT_PROVIDERS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>TTS provider</Label>
                <Select value={config.ttsProvider} onValueChange={(v) => update("ttsProvider", v)}>
                  <SelectTrigger><SelectValue placeholder="Select TTS" /></SelectTrigger>
                  <SelectContent>
                    {TTS_PROVIDERS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="voiceId">TTS voice id</Label>
              <Input id="voiceId" value={config.ttsVoiceId} onChange={(e) => update("ttsVoiceId", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="firstMessage">First message / greeting</Label>
              <Input id="firstMessage" value={config.firstMessage} onChange={(e) => update("firstMessage", e.target.value)} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
