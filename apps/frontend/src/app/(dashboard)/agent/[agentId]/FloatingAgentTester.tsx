"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  createChat,
  sendUserMessageWithReply,
  getChatMessages,
  listChats,
} from "../../../../utils/chatApi";
import { getAgentConfig, type AgentConfig } from "../../../../utils/agentConfigApi";
import { startVoiceSession, endVoiceSession, type VoiceSession } from "../../../../utils/livekitVoiceApi";
import { Button } from "@libs/shadcn-ui/components/ui/button";
import { Textarea } from "@libs/shadcn-ui/components/ui/textarea";
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

  // Voice call states
  const [voiceSession, setVoiceSession] = useState<VoiceSession | null>(null);
  const [voiceConnecting, setVoiceConnecting] = useState(false);
  const [agentState, setAgentState] = useState<string>("idle");
  const [micMuted, setMicMuted] = useState(false);

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
          const chats = await listChats(agentId);
          if (chats && chats.length > 0) {
            activeId = chats[0].id;
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
      const chat = await createChat(agentId, `Tester ${new Date().toLocaleString()}`, undefined, true);
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
      const { user, assistant } = await sendUserMessageWithReply(activeChatId, content);
      setTextMessages((prev) => {
        const clean = prev.filter((m) => m.id !== optimisticId);
        const next: ExtendedMessage[] = [
          ...clean,
          { id: user.id, role: "user", content: user.content },
        ];
        if (assistant) {
          next.push({ id: assistant.id, role: "assistant", content: assistant.content });
        }
        return next;
      });
    } catch (e) {
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
      const session = await startVoiceSession(agentId);
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
            className="shadow-xl bg-[#009959] hover:bg-[#007d49] text-white px-5 py-6 rounded-full gap-2 transition-all flex items-center border border-[#007d49]/35 hover:scale-105"
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
            "fixed z-50 bg-[#F8FAFC] shadow-2xl flex flex-col transition-all duration-350 border-0",
            isFullscreen
              ? "inset-0 rounded-none"
              : "bottom-6 right-6 w-[420px] h-[600px] rounded-2xl overflow-hidden"
          )}
        >
          {/* Header */}
          <div className="bg-[#222E50] text-white px-4 py-3 flex items-center justify-between border-b border-[#1a243f]">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-[#E6F7F0]/15 flex items-center justify-center text-[#009959]">
                <Bot className="h-4.5 w-4.5 text-[#009959]" />
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

          {/* Chat Window — outer overflow container */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            {/* Inner flex-col justify-end so messages always anchor bottom */}
            <div className="flex flex-col justify-end min-h-full p-4 gap-3">
            {loadingHistory && (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-[#009959]" />
                <span className="text-[10px] text-gray-400 mt-2">Loading history...</span>
              </div>
            )}

            {!loadingHistory && allMessages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6">
                <div className="h-10 w-10 bg-[#E6F7F0] text-[#009959] rounded-xl flex items-center justify-center mb-3">
                  <Sparkles className="h-5 w-5" />
                </div>
                <h4 className="text-xs font-bold text-gray-800">Start testing {config?.name || "your agent"}</h4>
                <p className="text-[10px] text-gray-500 max-w-[200px] mt-1 leading-normal">
                  Type a text prompt below, or connect WebRTC voice stage to speak directly.
                </p>
              </div>
            )}

            {/* Render message flow */}
            {!loadingHistory && allMessages.map((m) => {
              if (m.role === "system") {
                return (
                  <div key={m.id} className="flex justify-center my-2">
                    <span className="text-[9px] bg-slate-200/95 text-slate-600 px-3 py-1 rounded-full font-semibold shadow-sm tracking-wider uppercase">
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
                      "h-8 w-8 rounded-xl shadow-sm flex items-center justify-center flex-shrink-0 text-xs transition-all",
                      isUser ? "bg-[#009959] text-white" : "bg-white border border-gray-200 text-[#009959]"
                    )}
                  >
                    {isUser ? <User className="h-4.5 w-4.5" /> : <Bot className="h-4.5 w-4.5" />}
                  </div>
                  <div
                    className={cn(
                      "max-w-[75%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-sm whitespace-pre-wrap transition-all",
                      isUser
                        ? "bg-[#009959] text-white rounded-tr-none"
                        : "bg-white border border-gray-150 text-gray-850 rounded-tl-none"
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
                <div className="h-8 w-8 rounded-xl bg-white border border-gray-200 text-[#009959] flex items-center justify-center shadow-sm">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="rounded-2xl bg-white border border-gray-150 px-4 py-3 shadow-sm rounded-tl-none flex items-center">
                  <span className="flex gap-1.5 items-center h-3">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[#009959] [animation-delay:-0.3s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[#009959] [animation-delay:-0.15s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[#009959]" />
                  </span>
                </div>
              </div>
            )}
            </div>{/* end inner flex-col justify-end */}
          </div>{/* end outer scroll container */}

          {/* Composer Footer */}
          <div className="p-4 bg-white border-t border-gray-100 flex flex-col gap-2.5 shadow-md">
            {/* Input / Display Bar */}
            <div className="flex items-center gap-2.5 bg-slate-50 border border-gray-150 rounded-xl px-3 py-2 transition-all">
              {voiceConnecting ? (
                <div className="flex-1 flex items-center gap-2 text-xs text-slate-500 font-semibold py-1">
                  <Loader2 className="h-4 w-4 animate-spin text-[#009959]" />
                  Connecting to voice...
                </div>
              ) : voiceSession ? (
                <div className="flex-1 flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "h-2 w-2 rounded-full",
                      agentState === "speaking" ? "bg-amber-400 animate-pulse" : "bg-emerald-500 animate-ping"
                    )} />
                    <span className="text-xs font-bold text-gray-700">
                      {micMuted ? "Muted" : agentState === "speaking" ? "Agent speaking..." : "Speak now"}
                    </span>
                  </div>
                  {/* Wave Visualizer using Lucide colors simulation */}
                  <div className="flex items-center gap-0.5 h-4">
                    <span className="w-0.5 h-2 bg-yellow-400 rounded-full animate-bounce [animation-delay:-0.4s]" />
                    <span className="w-0.5 h-4 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.2s]" />
                    <span className="w-0.5 h-3 bg-red-400 rounded-full animate-bounce" />
                  </div>
                </div>
              ) : (
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  rows={1}
                  placeholder="Type your message..."
                  className="flex-1 resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 text-xs min-h-[24px] max-h-24 leading-relaxed"
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
                        "h-8 w-8 rounded-lg text-slate-500 hover:bg-slate-200 shrink-0",
                        micMuted && "text-red-500 bg-red-50 hover:bg-red-100"
                      )}
                    >
                      {micMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </Button>
                    <Button
                      onClick={handleEndVoice}
                      className="bg-red-500 hover:bg-red-600 text-white rounded-lg h-8 px-3 text-xs gap-1 shadow-sm font-semibold shrink-0"
                    >
                      <PhoneOff className="h-3.5 w-3.5" /> End Call
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      onClick={() => handleSendText(input)}
                      disabled={sending || !input.trim()}
                      size="icon"
                      className="h-8 w-8 rounded-lg bg-[#009959] hover:bg-[#007d49] text-white shadow-sm shrink-0 transition-colors"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      onClick={handleStartVoice}
                      disabled={voiceConnecting}
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 rounded-lg border-gray-250 hover:bg-slate-100 shrink-0 text-slate-600"
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
