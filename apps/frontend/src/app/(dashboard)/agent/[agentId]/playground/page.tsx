"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  listChats,
  createChat,
  getChatMessages,
  sendUserMessageWithReply,
  type ChatMessage,
} from "../../../../../utils/chatApi";
import { getAgentConfig, type AgentConfig } from "../../../../../utils/agentConfigApi";
import { startVoiceSession, endVoiceSession, type VoiceSession } from "../../../../../utils/livekitVoiceApi";
import { Button } from "@libs/shadcn-ui/components/ui/button";
import { Textarea } from "@libs/shadcn-ui/components/ui/textarea";
import { Skeleton } from "@libs/shadcn-ui/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@libs/shadcn-ui/components/ui/card";
import { toast } from "@libs/shadcn-ui/components/ui/use-toast";
import { Bot, Plus, Send, Sparkles, User, Mic, MicOff, Phone, PhoneOff, Loader2 } from "lucide-react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  BarVisualizer,
  useVoiceAssistant,
  useLocalParticipant,
  useRoomContext,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { RoomEvent, type TranscriptionSegment, type Participant } from "livekit-client";

const SUGGESTIONS = [
  "What can you help me with?",
  "Give me a quick summary of your knowledge.",
  "What is the capital of Japan?",
];

interface TranscriptLine {
  id: string;
  speaker: "agent" | "you";
  text: string;
  final: boolean;
}

export default function AgentPlaygroundPage() {
  const params = useParams();
  const agentId = params.agentId as string;

  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // LiveKit states
  const [voiceSession, setVoiceSession] = useState<VoiceSession | null>(null);
  const [voiceConnecting, setVoiceConnecting] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const cfg = await getAgentConfig(agentId).catch(() => null);
        setConfig(cfg);
        const chats = await listChats(agentId, "agent", "chat").catch(() => []);
        if (chats.length > 0) {
          setChatId(chats[0].id);
          setMessages(await getChatMessages(chats[0].id));
        }
      } catch (e) {
        toast({ title: "Failed to load playground", description: String(e), variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    if (agentId) init();
  }, [agentId]);

  useEffect(() => scrollToBottom(), [messages, sending, scrollToBottom]);

  // Auto-grow the composer textarea.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  const startNewConversation = async () => {
    try {
      const chat = await createChat(agentId, `Playground ${new Date().toLocaleString()}`, undefined, true);
      if (chat) {
        setChatId(chat.id);
        setMessages([]);
      }
    } catch (e) {
      toast({ title: "Could not start a new conversation", description: String(e), variant: "destructive" });
    }
  };

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || sending) return;

    let activeChatId = chatId;
    if (!activeChatId) {
      const chat = await createChat(agentId, `Playground ${new Date().toLocaleString()}`, undefined, true);
      if (!chat) {
        toast({ title: "Could not create a chat session", variant: "destructive" });
        return;
      }
      activeChatId = chat.id;
      setChatId(chat.id);
    }

    setInput("");
    const optimistic: ChatMessage = {
      id: `temp-${Date.now()}`,
      content,
      role: "user",
      sequenceId: messages.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      type: "text",
    };
    setMessages((prev) => [...prev, optimistic]);
    setSending(true);

    try {
      const { user, assistant } = await sendUserMessageWithReply(activeChatId, content);
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== optimistic.id);
        const next = [...withoutTemp, user];
        if (assistant) next.push(assistant);
        return next;
      });
      if (!assistant) {
        toast({
          title: "No reply generated",
          description: "The agent saved your message but produced no answer. Check the provider/model and API key.",
          variant: "destructive",
        });
      }
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      toast({ title: "Failed to send message", description: String(e), variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleStartVoice = useCallback(async () => {
    setVoiceConnecting(true);
    setVoiceError(null);
    try {
      const s = await startVoiceSession(agentId);
      setVoiceSession(s);
    } catch (e: any) {
      setVoiceError(e?.message || "Could not connect to voice room");
      toast({ title: "Voice Call Failed", description: e?.message || "Could not connect", variant: "destructive" });
    } finally {
      setVoiceConnecting(false);
    }
  }, [agentId]);

  const handleEndVoice = useCallback(async () => {
    const room = voiceSession?.room;
    setVoiceSession(null);
    if (room) {
      await endVoiceSession(room);
    }
  }, [voiceSession]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const isEmpty = !loading && messages.length === 0;

  return (
    <div className="flex h-screen flex-col bg-[#F8FAFC]">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E6F7F0] text-[#009959]">
            <Bot className="h-6 w-6" />
          </div>
          <div className="leading-tight">
            <h1 className="text-base font-semibold text-gray-900">{config?.name || "Agent"} · Sandbox Playground</h1>
            <p className="text-xs text-gray-500">
              {config?.provider ? (
                <>
                  <span className="capitalize">{config.provider}</span>
                  {config.model ? ` (${config.model})` : ""}
                </>
              ) : (
                "Test text and WebRTC voice calls end-to-end"
              )}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={startNewConversation} className="gap-2 border-gray-200 hover:bg-gray-50">
          <Plus className="h-4 w-4" /> New conversation
        </Button>
      </header>

      {/* Main Body Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 overflow-hidden">
        {/* Left Column: Chat Sandbox */}
        <div className="lg:col-span-2 flex flex-col border-r border-gray-200 overflow-hidden bg-white">
          <div ref={scrollRef} className="flex-1 overflow-y-auto bg-slate-50/30">
            {isEmpty ? (
              <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center px-6 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E6F7F0] text-[#009959]">
                  <Sparkles className="h-7 w-7" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Chat with {config?.name || "your agent"}</h2>
                <p className="mt-2 text-sm text-gray-500 max-w-sm">
                  This uses the same single-brain runtime as production, executing RAG and tools.
                </p>
                <div className="mt-8 grid w-full gap-3 sm:grid-cols-3">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm text-gray-700 transition-all hover:border-[#009959] hover:bg-[#E6F7F0]/20 hover:shadow-sm"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
                {loading ? (
                  <>
                    <Skeleton className="h-16 w-2/3" />
                    <Skeleton className="ml-auto h-16 w-1/2" />
                  </>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className={`flex items-start gap-3.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                      <div
                        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl shadow-sm ${
                          m.role === "user" ? "bg-[#222E50] text-white" : "bg-[#E6F7F0] text-[#009959]"
                        }`}
                      >
                        {m.role === "user" ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
                      </div>
                      <div
                        className={`max-w-[75%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                          m.role === "user"
                            ? "bg-[#222E50] text-white rounded-tr-none"
                            : "bg-white border border-gray-150 text-gray-900 rounded-tl-none"
                        }`}
                      >
                        {m.content}
                      </div>
                    </div>
                  ))
                )}
                {sending && (
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E6F7F0] text-[#009959] shadow-sm">
                      <Bot className="h-5 w-5" />
                    </div>
                    <div className="rounded-2xl bg-white border border-gray-150 px-4 py-3.5 shadow-sm rounded-tl-none">
                      <span className="flex gap-1.5 items-center h-4">
                        <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-[#009959] [animation-delay:-0.3s]" />
                        <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-[#009959] [animation-delay:-0.15s]" />
                        <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-[#009959]" />
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="border-t border-gray-200 bg-white p-4">
            <div className="mx-auto max-w-3xl">
              <div className="flex items-end gap-2.5 rounded-2xl border border-gray-250 bg-white px-3 py-2.5 shadow-sm focus-within:border-[#009959] focus-within:ring-1 focus-within:ring-[#009959]/20 transition-all">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  rows={1}
                  placeholder={`Message ${config?.name || "the agent"}…`}
                  className="max-h-52 min-h-[24px] flex-1 resize-none border-0 bg-transparent p-1 shadow-none focus-visible:ring-0 text-sm"
                />
                <Button
                  onClick={() => send(input)}
                  disabled={sending || !input.trim()}
                  size="icon"
                  className="h-9 w-9 flex-shrink-0 rounded-xl bg-[#009959] hover:bg-[#007d49] shadow-sm transition-all"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-2 text-center text-[11px] text-gray-400">
                Press Enter to send · Shift+Enter for a new line
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Voice Call Sandbox */}
        <div className="p-6 bg-slate-50 flex flex-col gap-6 overflow-y-auto">
          <Card className="shadow-md border-0 bg-white rounded-2xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold text-gray-900">Voice Sandbox</CardTitle>
              <CardDescription>Start a real-time WebRTC audio call using local Livekit server.</CardDescription>
            </CardHeader>
            <CardContent>
              {voiceError && (
                <div className="mb-4 rounded-xl border border-red-150 bg-red-50/50 p-3 text-xs text-red-700">
                  {voiceError}
                </div>
              )}

              {!voiceSession ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border-2 border-dashed border-gray-200 p-6 text-center bg-gray-50/50">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#E6F7F0] text-[#009959]">
                      <Phone className="h-6 w-6" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900">Audio Session</h3>
                    <p className="mt-1 text-xs text-gray-500 max-w-[200px] mx-auto leading-relaxed">
                      Connect your mic to speak with {config?.name || "the agent"} dynamically.
                    </p>
                  </div>
                  
                  <Button
                    onClick={handleStartVoice}
                    disabled={voiceConnecting}
                    className="w-full bg-[#009959] hover:bg-[#007d49] text-white py-5 rounded-xl font-medium gap-2 shadow-sm transition-all"
                  >
                    {voiceConnecting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Calling…
                      </>
                    ) : (
                      <>
                        <Phone className="h-4 w-4" /> Connect Voice
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <LiveKitRoom
                  serverUrl={voiceSession.url}
                  token={voiceSession.token}
                  connect
                  audio
                  video={false}
                  onDisconnected={handleEndVoice}
                  data-lk-theme="default"
                  className="rounded-xl border border-gray-150 bg-slate-50/50 overflow-hidden shadow-inner"
                >
                  <RoomAudioRenderer />
                  <PlaygroundCallStage agentName={config?.name || "Agent"} onEnd={handleEndVoice} />
                </LiveKitRoom>
              )}
            </CardContent>
          </Card>

          {config?.channels.voice && (
            <Card className="shadow-sm border border-gray-200/60 bg-white rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-gray-800">Voice Info</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-gray-500 space-y-2">
                <div className="flex justify-between">
                  <span>STT Provider:</span>
                  <span className="font-medium text-gray-800 capitalize">{config.sttProvider || "default"}</span>
                </div>
                <div className="flex justify-between">
                  <span>TTS Provider:</span>
                  <span className="font-medium text-gray-800 capitalize">{config.ttsProvider || "default"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Voice ID:</span>
                  <span className="font-mono text-gray-800 font-medium">{config.ttsVoiceId || "default"}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function PlaygroundCallStage({ agentName, onEnd }: { agentName: string; onEnd: () => void }) {
  const { state, audioTrack } = useVoiceAssistant();
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  const [micOn, setMicOn] = useState(true);
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!room) return;
    const onTranscription = (
      segments: TranscriptionSegment[],
      participant?: Participant
    ) => {
      const isAgent = participant?.identity !== localParticipant?.identity;
      setLines((prev) => {
        const next = [...prev];
        for (const seg of segments) {
          const idx = next.findIndex((l) => l.id === seg.id);
          const line: TranscriptLine = {
            id: seg.id,
            speaker: isAgent ? "agent" : "you",
            text: seg.text,
            final: seg.final,
          };
          if (idx >= 0) next[idx] = line;
          else next.push(line);
        }
        return next;
      });
    };
    room.on(RoomEvent.TranscriptionReceived, onTranscription);
    return () => {
      room.off(RoomEvent.TranscriptionReceived, onTranscription);
    };
  }, [room, localParticipant]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  const toggleMic = useCallback(async () => {
    const next = !micOn;
    setMicOn(next);
    await localParticipant?.setMicrophoneEnabled(next);
  }, [micOn, localParticipant]);

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">Active Session</div>
          <div className="text-base font-bold text-gray-900">{agentName}</div>
        </div>
        <span className="rounded-full bg-[#E6F7F0] px-2.5 py-1 text-xs font-semibold capitalize text-[#009959]">
          {state || "connecting"}
        </span>
      </div>

      <div className="flex h-24 items-center justify-center rounded-xl bg-white border border-gray-150 shadow-inner">
        <BarVisualizer
          state={state}
          barCount={7}
          trackRef={audioTrack}
          className="h-16 w-56"
          options={{ minHeight: 6 }}
        />
      </div>

      <div
        ref={scrollRef}
        className="h-44 space-y-2.5 overflow-y-auto rounded-xl border border-gray-200/80 bg-white p-3 shadow-sm"
      >
        {lines.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-xs text-gray-400 px-4">
            Start speaking to test the agent response. Your transcript will show here.
          </div>
        ) : (
          lines.map((l) => (
            <div key={l.id} className={l.speaker === "you" ? "text-right" : "text-left"}>
              <span
                className={
                  "inline-block max-w-[85%] rounded-2xl px-3 py-1.5 text-xs " +
                  (l.speaker === "you"
                    ? "bg-[#009959] text-white rounded-tr-none"
                    : "bg-slate-100 text-gray-900 rounded-tl-none")
                }
              >
                {l.text}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center justify-center gap-2">
        <Button variant="outline" size="sm" onClick={toggleMic} className="flex-1 gap-2 rounded-xl border-gray-250">
          {micOn ? <Mic className="h-3.5 w-3.5 text-[#009959]" /> : <MicOff className="h-3.5 w-3.5 text-red-500" />}
          {micOn ? "Mute" : "Unmute"}
        </Button>
        <Button onClick={onEnd} size="sm" className="flex-1 gap-2 bg-red-600 hover:bg-red-700 text-white rounded-xl">
          <PhoneOff className="h-3.5 w-3.5" /> End Call
        </Button>
      </div>
    </div>
  );
}
