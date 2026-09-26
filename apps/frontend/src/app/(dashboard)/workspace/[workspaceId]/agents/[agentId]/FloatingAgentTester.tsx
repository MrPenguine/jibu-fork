"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  createTestChat,
  sendUserMessageWithReply,
  getChatMessages,
  listChats,
  type Chat,
} from "../../../../../../utils/chatApi";
import { getAgentConfig, type AgentConfig } from "../../../../../../utils/agentConfigApi";
import { startVoiceSession, endVoiceSession, type VoiceSession } from "../../../../../../utils/livekitVoiceApi";
import { listContacts, createContact, type Contact } from "../../../../../../utils/contactApi";
import { Button } from "@libs/shadcn-ui/components/ui/button";
import { Textarea } from "@libs/shadcn-ui/components/ui/textarea";
import { Input } from "@libs/shadcn-ui/components/ui/input";
import { toast } from "@libs/shadcn-ui/components/ui/use-toast";
import {
  Bot,
  Sparkles,
  User,
  Mic,
  MicOff,
  PhoneOff,
  Loader2,
  X,
  Maximize2,
  Minimize2,
  Send,
  MessageSquare,
  Volume2,
  List,
  Plus,
  UserCircle2,
} from "lucide-react";
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
import { cn } from "@libs/shadcn-ui/lib/utils";

interface ExtendedMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

export function FloatingAgentTester() {
  const params = useParams();
  const agentId = params?.agentId as string;

  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  
  // Separate text messages (persisted) and voice segments (live transcription)
  const [textMessages, setTextMessages] = useState<ExtendedMessage[]>([]);
  const [voiceSegments, setVoiceSegments] = useState<ExtendedMessage[]>([]);
  
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Chat list sidebar (toggled on/off, lists past chats for this agent)
  const [showChatList, setShowChatList] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);

  // Voice call states
  const [voiceSession, setVoiceSession] = useState<VoiceSession | null>(null);
  const [voiceConnecting, setVoiceConnecting] = useState(false);
  const [agentState, setAgentState] = useState<string>("idle");
  const [micMuted, setMicMuted] = useState(false);

  // Persona step — gates a fresh chat (text or voice) behind picking/creating
  // a test persona, which becomes the Contact linked to that chat/call.
  const [selectedPersona, setSelectedPersona] = useState<Contact | null>(null);
  const [personaSkipped, setPersonaSkipped] = useState(false);
  const [personas, setPersonas] = useState<Contact[]>([]);
  const [loadingPersonas, setLoadingPersonas] = useState(false);
  const [personaSearch, setPersonaSearch] = useState("");
  const [newPersonaName, setNewPersonaName] = useState("");
  const [newPersonaPhone, setNewPersonaPhone] = useState("");
  const [creatingPersona, setCreatingPersona] = useState(false);

  // No active chat and no persona decision made yet — a fresh chat/voice
  // session, so show the picker instead of the composer/empty state.
  const needsPersonaStep = !chatId && !voiceSession && !selectedPersona && !personaSkipped;

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Combine both message lists for the unified feed display
  const allMessages = React.useMemo(() => {
    return [...textMessages, ...voiceSegments];
  }, [textMessages, voiceSegments]);

  // Load config & chat history
  useEffect(() => {
    if (!agentId || !isOpen) return;
    
    getAgentConfig(agentId)
      .then(setConfig)
      .catch((e) => console.error("Failed to load agent config:", e));

    const loadPersistedChat = async () => {
      try {
        setLoadingHistory(true);
        const storageKey = `agent_tester_chat_${agentId}`;
        let activeId = localStorage.getItem(storageKey);

        if (!activeId) {
          const existingChats = await listChats(agentId, "agent");
          if (existingChats && existingChats.length > 0) {
            activeId = existingChats[0].id;
            localStorage.setItem(storageKey, activeId);
          }
        }

        if (activeId) {
          setChatId(activeId);
          const history = await getChatMessages(activeId);
          setTextMessages(
            history.map((m) => ({
              id: m.id,
              role: m.role as "user" | "assistant",
              content: m.content,
            }))
          );
        }
      } catch (e) {
        console.error("Failed to load chat history:", e);
      } finally {
        setLoadingHistory(false);
      }
    };

    loadPersistedChat();
  }, [agentId, isOpen]);

  // Load personas whenever the picker is actually shown — cheap, and keeps
  // the list fresh if another persona was created elsewhere meanwhile.
  useEffect(() => {
    if (!isOpen || !needsPersonaStep) return;
    setLoadingPersonas(true);
    listContacts(personaSearch || undefined)
      .then((r) => setPersonas(r.contacts))
      .catch((e) => console.error("Failed to load personas:", e))
      .finally(() => setLoadingPersonas(false));
  }, [isOpen, needsPersonaStep, personaSearch]);

  const handlePickPersona = (persona: Contact) => {
    setSelectedPersona(persona);
    setPersonaSkipped(false);
  };

  const handleSkipPersona = () => {
    setPersonaSkipped(true);
  };

  const handleCreatePersona = async () => {
    const phone = newPersonaPhone.trim();
    if (!phone || creatingPersona) return;
    setCreatingPersona(true);
    try {
      const created = await createContact({
        externalId: phone,
        displayName: newPersonaName.trim() || undefined,
        channel: "phone",
      });
      if (created) {
        setSelectedPersona(created);
        setPersonaSkipped(false);
        setNewPersonaName("");
        setNewPersonaPhone("");
      } else {
        toast({ title: "Could not create persona", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Could not create persona", description: String(e), variant: "destructive" });
    } finally {
      setCreatingPersona(false);
    }
  };

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (scrollRef.current) {
      const el = scrollRef.current;
      // Immediate jump on initial load, smooth on new messages
      if (behavior === "instant") {
        el.scrollTop = el.scrollHeight;
      } else {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      }
    }
  }, []);

  // Scroll to bottom on every message update
  useEffect(() => {
    // Use a rAF so DOM has been painted before we measure scrollHeight
    const raf = requestAnimationFrame(() => scrollToBottom("smooth"));
    return () => cancelAnimationFrame(raf);
  }, [allMessages, sending, scrollToBottom]);

  const initChat = async () => {
    if (chatId) return chatId;
    try {
      const chat = await createTestChat({
        agentId,
        name: `Tester ${new Date().toLocaleString()}`,
        contactExternalId: selectedPersona?.externalId,
        channel: "phone",
      });
      if (chat) {
        setChatId(chat.id);
        localStorage.setItem(`agent_tester_chat_${agentId}`, chat.id);
        return chat.id;
      }
    } catch (e) {
      console.error("Failed to create chat session:", e);
    }
    return null;
  };

  const loadChatList = async () => {
    setLoadingChats(true);
    try {
      const list = await listChats(agentId, "agent");
      setChats(list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
    } catch (e) {
      console.error("Failed to load chat list:", e);
    } finally {
      setLoadingChats(false);
    }
  };

  const toggleChatList = () => {
    const next = !showChatList;
    setShowChatList(next);
    if (next) loadChatList();
  };

  const handleSelectChat = async (id: string) => {
    if (id === chatId) {
      setShowChatList(false);
      return;
    }
    setShowChatList(false);
    setLoadingHistory(true);
    try {
      setChatId(id);
      localStorage.setItem(`agent_tester_chat_${agentId}`, id);
      const history = await getChatMessages(id);
      setTextMessages(
        history.map((m) => ({ id: m.id, role: m.role as "user" | "assistant", content: m.content }))
      );
    } catch (e) {
      toast({ title: "Failed to load chat", description: String(e), variant: "destructive" });
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleNewChat = () => {
    setShowChatList(false);
    setChatId(null);
    setTextMessages([]);
    localStorage.removeItem(`agent_tester_chat_${agentId}`);
    // Force the persona step again for the next chat.
    setSelectedPersona(null);
    setPersonaSkipped(false);
  };

  const handleSendText = async (text: string) => {
    const content = text.trim();
    if (!content || sending) return;

    setInput("");
    const activeChatId = await initChat();
    if (!activeChatId) {
      toast({ title: "Could not start chat session", variant: "destructive" });
      return;
    }

    const optimisticId = `temp-${Date.now()}`;
    setTextMessages((prev) => [...prev, { id: optimisticId, role: "user", content }]);
    setSending(true);

    try {
      const { user, assistant, replyError } = await sendUserMessageWithReply(activeChatId, content);
      setTextMessages((prev) => {
        const clean = prev.filter((m) => m.id !== optimisticId);
        const next: ExtendedMessage[] = [
          ...clean,
          { id: user.id, role: "user", content: user.content },
        ];
        if (assistant) {
          next.push({ id: assistant.id, role: "assistant", content: assistant.content });
        } else if (replyError) {
          next.push({ id: `sys-${Date.now()}`, role: "system", content: `Agent failed to respond: ${replyError}` });
        }
        return next;
      });
      if (replyError) {
        toast({ title: "Agent failed to respond", description: replyError, variant: "destructive" });
      }
    } catch (e) {
      // The message itself never reached the server — this IS a lost send, unlike a replyError.
      setTextMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      toast({ title: "Failed to send message", description: String(e), variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleStartVoice = async () => {
    setVoiceConnecting(true);
    setMicMuted(false);
    try {
      const session = await startVoiceSession(agentId, selectedPersona?.externalId);
      setVoiceSession(session);
      setTextMessages((prev) => [
        ...prev,
        { id: `sys-${Date.now()}`, role: "system", content: "Voice session started" },
      ]);
    } catch (e: any) {
      toast({ title: "Voice Call Failed", description: e?.message || "Could not connect", variant: "destructive" });
    } finally {
      setVoiceConnecting(false);
    }
  };

  const handleEndVoice = async () => {
    const room = voiceSession?.room;
    setVoiceSession(null);
    if (room) {
      await endVoiceSession(room);
    }
    
    // Commit finalize voice transcription segments to textMessages list to persist history
    setTextMessages((prev) => [
      ...prev,
      ...voiceSegments,
      { id: `sys-${Date.now()}`, role: "system", content: "Voice session ended" },
    ]);
    setVoiceSegments([]);
    setAgentState("idle");
    setMicMuted(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendText(input);
    }
  };

  return (
    <>
      {/* Floating Pill Button */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            onClick={() => setIsOpen(true)}
            className="shadow-xl bg-brand-green hover:bg-brand-green/90 text-white px-5 py-6 rounded-full gap-2 transition-all flex items-center border border-brand-green/35 hover:scale-105"
          >
            <MessageSquare className="h-5 w-5" />
            <span className="font-semibold text-sm">Test your Agent</span>
          </Button>
        </div>
      )}

      {/* Floating Card Pop-up */}
      {isOpen && (
        <div
          className={cn(
            "fixed z-50 bg-background shadow-2xl flex flex-col transition-all duration-350",
            isFullscreen
              ? "inset-0 rounded-none"
              : "bottom-6 right-6 w-[420px] h-[600px] rounded-lg overflow-hidden"
          )}
        >
          {/* Header */}
          <div className="bg-brand-navy text-white px-4 py-3 flex items-center justify-between border-b border-black/10">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-white/15 flex items-center justify-center text-brand-green">
                <Bot className="h-4.5 w-4.5 text-brand-green" />
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-200 leading-none">Testing Room</div>
                <div className="text-sm font-bold text-white mt-1 truncate max-w-[200px]">
                  {config?.name || "AI Agent"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleChatList}
                aria-label="Toggle chat history"
                className={cn(
                  "h-8 w-8 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg",
                  showChatList && "bg-white/15 text-white"
                )}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="h-8 w-8 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg"
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (voiceSession) handleEndVoice();
                  setIsOpen(false);
                  setIsFullscreen(false);
                }}
                className="h-8 w-8 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Chat history sidebar — slides in over the chat window, toggled via the header List button */}
          <div
            className={cn(
              "absolute inset-y-0 left-0 z-10 w-60 bg-card border-r border-border shadow-lg flex flex-col transition-transform duration-200",
              showChatList ? "translate-x-0" : "-translate-x-full"
            )}
          >
            <div className="p-3 border-b border-border">
              <Button
                onClick={handleNewChat}
                variant="outline"
                className="w-full h-8 rounded-md border-brand-green text-brand-green hover:bg-accent gap-1.5 text-xs font-semibold"
              >
                <Plus className="h-3.5 w-3.5" /> New chat
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {loadingChats && (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-brand-green" />
                </div>
              )}
              {!loadingChats && chats.length === 0 && (
                <p className="text-[10px] text-muted-foreground text-center px-2 py-6">No past chats yet.</p>
              )}
              {!loadingChats &&
                chats.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelectChat(c.id)}
                    className={cn(
                      "w-full text-left rounded-md px-2.5 py-2 text-xs transition-colors truncate",
                      c.id === chatId
                        ? "bg-accent text-brand-green font-semibold"
                        : "text-foreground hover:bg-background"
                    )}
                  >
                    {c.name || `Chat ${new Date(c.createdAt).toLocaleDateString()}`}
                  </button>
                ))}
            </div>
          </div>
          {showChatList && (
            <div
              className="absolute inset-0 z-[5] bg-black/5"
              onClick={() => setShowChatList(false)}
            />
          )}

          {/* Chat Window — outer overflow container */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            {/* Inner flex-col justify-end so messages always anchor bottom */}
            <div className="flex flex-col justify-end min-h-full p-4 gap-3">
            {loadingHistory && (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-brand-green" />
                <span className="text-[10px] text-gray-400 mt-2">Loading history...</span>
              </div>
            )}

            {!loadingHistory && needsPersonaStep && (
              <div className="flex flex-col gap-3 p-1">
                <div className="text-center">
                  <div className="h-10 w-10 bg-accent text-brand-green rounded-lg flex items-center justify-center mb-2 mx-auto">
                    <UserCircle2 className="h-5 w-5" />
                  </div>
                  <h4 className="text-xs font-bold text-foreground">Who's testing today?</h4>
                  <p className="text-[10px] text-muted-foreground max-w-[220px] mt-1 mx-auto leading-normal">
                    Pick or create a persona — it becomes the contact linked to this chat or call, for both text and voice.
                  </p>
                </div>

                <Input
                  value={personaSearch}
                  onChange={(e) => setPersonaSearch(e.target.value)}
                  placeholder="Search personas…"
                  className="h-8 text-xs"
                />

                <div className="max-h-32 overflow-y-auto space-y-1">
                  {loadingPersonas && (
                    <div className="flex justify-center py-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-green" />
                    </div>
                  )}
                  {!loadingPersonas && personas.length === 0 && (
                    <p className="text-[10px] text-muted-foreground text-center py-2">No personas yet — create one below.</p>
                  )}
                  {!loadingPersonas &&
                    personas.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handlePickPersona(p)}
                        className="w-full text-left rounded-md px-2.5 py-1.5 text-xs bg-card border border-border hover:bg-accent transition-colors flex items-center gap-2"
                      >
                        <UserCircle2 className="h-3.5 w-3.5 text-brand-green shrink-0" />
                        <span className="truncate">
                          {p.displayName ? <strong>{p.displayName}</strong> : null}
                          {p.displayName ? " · " : ""}
                          {p.externalId}
                        </span>
                      </button>
                    ))}
                </div>

                <div className="border-t border-border pt-2.5 space-y-1.5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">New persona</p>
                  <Input
                    value={newPersonaName}
                    onChange={(e) => setNewPersonaName(e.target.value)}
                    placeholder="Name (e.g. Riley)"
                    className="h-8 text-xs"
                  />
                  <Input
                    value={newPersonaPhone}
                    onChange={(e) => setNewPersonaPhone(e.target.value)}
                    placeholder="+2547..."
                    className="h-8 text-xs"
                  />
                  <Button
                    onClick={handleCreatePersona}
                    disabled={creatingPersona || !newPersonaPhone.trim()}
                    className="w-full h-8 text-xs bg-brand-green hover:bg-brand-green/90 text-white"
                  >
                    {creatingPersona ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                    Create & continue
                  </Button>
                </div>

                <button
                  type="button"
                  onClick={handleSkipPersona}
                  className="text-[10px] text-muted-foreground hover:text-foreground underline text-center"
                >
                  Skip — start anonymous
                </button>
              </div>
            )}

            {!loadingHistory && !needsPersonaStep && allMessages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6">
                <div className="h-10 w-10 bg-accent text-brand-green rounded-lg flex items-center justify-center mb-3">
                  <Sparkles className="h-5 w-5" />
                </div>
                <h4 className="text-xs font-bold text-foreground">
                  {selectedPersona ? `Testing as ${selectedPersona.displayName || selectedPersona.externalId}` : `Start testing ${config?.name || "your agent"}`}
                </h4>
                <p className="text-[10px] text-muted-foreground max-w-[200px] mt-1 leading-normal">
                  Type a text prompt below, or connect WebRTC voice stage to speak directly.
                </p>
              </div>
            )}

            {/* Render message flow */}
            {!loadingHistory && allMessages.map((m) => {
              if (m.role === "system") {
                return (
                  <div key={m.id} className="flex justify-center my-2">
                    <span className="text-[9px] bg-muted text-muted-foreground px-3 py-1 rounded-full font-semibold shadow-sm tracking-wider uppercase">
                      {m.content}
                    </span>
                  </div>
                );
              }
              const isUser = m.role === "user";
              return (
                <div key={m.id} className={cn("flex items-start gap-2.5", isUser && "flex-row-reverse")}>
                  <div
                    className={cn(
                      "h-8 w-8 rounded-lg shadow-sm flex items-center justify-center flex-shrink-0 text-xs transition-all",
                      isUser ? "bg-brand-green text-white" : "bg-card border border-border text-brand-green"
                    )}
                  >
                    {isUser ? <User className="h-4.5 w-4.5" /> : <Bot className="h-4.5 w-4.5" />}
                  </div>
                  <div
                    className={cn(
                      "max-w-[75%] rounded-lg px-4 py-2.5 text-xs leading-relaxed shadow-sm whitespace-pre-wrap transition-all",
                      isUser
                        ? "bg-brand-green text-white rounded-tr-none"
                        : "bg-card border border-border text-foreground rounded-tl-none"
                    )}
                  >
                    {m.content}
                  </div>
                </div>
              );
            })}

            {/* LiveKit Room Connection */}
            {voiceSession && (
              <LiveKitRoom
                serverUrl={voiceSession.url}
                token={voiceSession.token}
                connect
                audio
                video={false}
                onDisconnected={handleEndVoice}
              >
                <RoomAudioRenderer />
                <VoiceChatSync
                  onTranscriptionUpdate={(segments, localIdentity) => {
                    setVoiceSegments((prev) => {
                      const next = [...prev];
                      for (const seg of segments) {
                        const isAgent = seg.participant?.identity !== localIdentity;
                        const idx = next.findIndex((m) => m.id === seg.id);
                        const msg: ExtendedMessage = {
                          id: seg.id,
                          role: isAgent ? "assistant" : "user",
                          content: seg.text,
                        };
                        if (idx >= 0) {
                          next[idx] = msg;
                        } else {
                          next.push(msg);
                        }
                      }
                      return next;
                    });
                  }}
                  onAgentStateChange={setAgentState}
                  micMuted={micMuted}
                />
              </LiveKitRoom>
            )}

            {/* Bouncing Dots Typing Indicator */}
            {sending && (
              <div className="flex items-start gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-card border border-border text-brand-green flex items-center justify-center shadow-sm">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="rounded-lg bg-card border border-border px-4 py-3 shadow-sm rounded-tl-none flex items-center">
                  <span className="flex gap-1.5 items-center h-3">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-brand-green [animation-delay:-0.3s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-brand-green [animation-delay:-0.15s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-brand-green" />
                  </span>
                </div>
              </div>
            )}
            </div>{/* end inner flex-col justify-end */}
          </div>{/* end outer scroll container */}

          {/* Composer Footer */}
          <div className="p-4 bg-card border-t border-gray-100 flex flex-col gap-2.5 shadow-sm">
            {/* Input / Display Bar */}
            <div className="flex items-center gap-2.5 bg-background border border-input rounded-md px-3 py-2 transition-all">
              {voiceConnecting ? (
                <div className="flex-1 flex items-center gap-2 text-xs text-muted-foreground font-semibold py-1">
                  <Loader2 className="h-4 w-4 animate-spin text-brand-green" />
                  Connecting to voice...
                </div>
              ) : voiceSession ? (
                <div className="flex-1 flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "h-2 w-2 rounded-full",
                      agentState === "speaking" ? "bg-brand-saffron animate-pulse" : "bg-brand-green animate-ping"
                    )} />
                    <span className="text-xs font-bold text-gray-700">
                      {micMuted ? "Muted" : agentState === "speaking" ? "Agent speaking..." : "Speak now"}
                    </span>
                  </div>
                  {/* Wave Visualizer using Lucide colors simulation */}
                  <div className="flex items-center gap-0.5 h-4">
                    <span className="w-0.5 h-2 bg-brand-saffron rounded-full animate-bounce [animation-delay:-0.4s]" />
                    <span className="w-0.5 h-4 bg-brand-green rounded-full animate-bounce [animation-delay:-0.2s]" />
                    <span className="w-0.5 h-3 bg-brand-cinnabar rounded-full animate-bounce" />
                  </div>
                </div>
              ) : (
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  rows={1}
                  disabled={needsPersonaStep}
                  placeholder={needsPersonaStep ? "Pick a persona above to start..." : "Type your message..."}
                  className="flex-1 resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 text-xs min-h-[24px] max-h-24 leading-relaxed disabled:opacity-50"
                />
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5">
                {voiceSession ? (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setMicMuted(!micMuted)}
                      className={cn(
                        "h-8 w-8 rounded-lg text-muted-foreground hover:bg-gray-200 shrink-0",
                        micMuted && "text-destructive bg-destructive/10 hover:bg-destructive/20"
                      )}
                    >
                      {micMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </Button>
                    <Button
                      onClick={handleEndVoice}
                      className="bg-destructive hover:bg-destructive/90 text-white rounded-lg h-8 px-3 text-xs gap-1 shadow-sm font-semibold shrink-0"
                    >
                      <PhoneOff className="h-3.5 w-3.5" /> End Call
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      onClick={() => handleSendText(input)}
                      disabled={sending || !input.trim() || needsPersonaStep}
                      size="icon"
                      className="h-8 w-8 rounded-lg bg-brand-green hover:bg-brand-green/90 text-white shadow-sm shrink-0 transition-colors"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      onClick={handleStartVoice}
                      disabled={voiceConnecting || needsPersonaStep}
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 rounded-lg border-input hover:bg-background shrink-0 text-muted-foreground"
                    >
                      <Mic className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
            
            <div className="flex items-center justify-between text-[10px] text-gray-400">
              <span>{voiceSession ? "Voice Mode Active" : "Press Enter to send"}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Sync LiveKit speech transcription segment state & agent talk state
function VoiceChatSync({
  onTranscriptionUpdate,
  onAgentStateChange,
  micMuted,
}: {
  onTranscriptionUpdate: (segments: any[], localIdentity: string) => void;
  onAgentStateChange: (state: string) => void;
  micMuted: boolean;
}) {
  const { localParticipant } = useLocalParticipant();
  const { state } = useVoiceAssistant();
  const room = useRoomContext();

  // Sync assistant state
  useEffect(() => {
    onAgentStateChange(state);
  }, [state, onAgentStateChange]);

  // Sync local mic mute toggle state
  useEffect(() => {
    if (localParticipant) {
      localParticipant.setMicrophoneEnabled(!micMuted);
    }
  }, [micMuted, localParticipant]);

  // Handle live WebRTC speech transcription events
  useEffect(() => {
    if (!room || !localParticipant) return;

    const onTranscription = (segments: TranscriptionSegment[], participant?: Participant) => {
      // Map segments to transcription layout with participant information
      const mapped = segments.map((seg) => ({
        id: seg.id,
        text: seg.text,
        final: seg.final,
        participant,
      }));
      onTranscriptionUpdate(mapped, localParticipant.identity);
    };

    room.on(RoomEvent.TranscriptionReceived, onTranscription);
    return () => {
      room.off(RoomEvent.TranscriptionReceived, onTranscription);
    };
  }, [room, localParticipant, onTranscriptionUpdate]);

  return null;
}
