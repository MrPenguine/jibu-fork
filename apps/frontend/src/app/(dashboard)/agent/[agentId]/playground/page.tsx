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
import { Button } from "@libs/shadcn-ui/components/ui/button";
import { Textarea } from "@libs/shadcn-ui/components/ui/textarea";
import { Skeleton } from "@libs/shadcn-ui/components/ui/skeleton";
import { toast } from "@libs/shadcn-ui/components/ui/use-toast";
import { Bot, Plus, Send, Sparkles, User } from "lucide-react";

const SUGGESTIONS = [
  "What can you help me with?",
  "Give me a quick summary of your knowledge.",
  "What is the capital of Japan?",
];

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

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const isEmpty = !loading && messages.length === 0;

  return (
    <div className="flex h-screen flex-col bg-white">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-100 px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E6F7F0] text-[#009959]">
            <Bot className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <h1 className="text-sm font-semibold text-gray-900">{config?.name || "Agent"} · Playground</h1>
            <p className="text-xs text-gray-400">
              {config?.provider ? (
                <>
                  {config.provider}
                  {config.model ? ` · ${config.model}` : ""}
                </>
              ) : (
                "Test your agent end-to-end"
              )}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={startNewConversation} className="gap-2">
          <Plus className="h-4 w-4" /> New chat
        </Button>
      </header>

      {/* Conversation */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center px-6 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E6F7F0] text-[#009959]">
              <Sparkles className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Chat with {config?.name || "your agent"}</h2>
            <p className="mt-1 text-sm text-gray-500">
              This uses the same single-brain runtime as production — RAG, tools and your configured model.
            </p>
            <div className="mt-6 grid w-full gap-2 sm:grid-cols-3">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-xl border border-gray-200 px-3 py-3 text-left text-sm text-gray-700 transition-colors hover:border-[#009959] hover:bg-[#E6F7F0]/40"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
            {loading ? (
              <>
                <Skeleton className="h-16 w-2/3" />
                <Skeleton className="ml-auto h-16 w-1/2" />
              </>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`flex items-start gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
                      m.role === "user" ? "bg-[#222E50] text-white" : "bg-[#E6F7F0] text-[#009959]"
                    }`}
                  >
                    {m.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>
                  <div
                    className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      m.role === "user" ? "bg-[#222E50] text-white" : "bg-gray-100 text-gray-900"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))
            )}
            {sending && (
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E6F7F0] text-[#009959]">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="rounded-2xl bg-gray-100 px-4 py-3">
                  <span className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" />
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-gray-100 bg-white px-4 py-4">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-end gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2 shadow-sm focus-within:border-[#009959]">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder={`Message ${config?.name || "the agent"}…`}
              className="max-h-52 min-h-[24px] flex-1 resize-none border-0 bg-transparent p-1 shadow-none focus-visible:ring-0"
            />
            <Button
              onClick={() => send(input)}
              disabled={sending || !input.trim()}
              size="icon"
              className="h-9 w-9 flex-shrink-0 rounded-xl bg-[#009959] hover:bg-[#007d49]"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-2 text-center text-xs text-gray-400">
            Press Enter to send · Shift+Enter for a new line
          </p>
        </div>
      </div>
    </div>
  );
}
