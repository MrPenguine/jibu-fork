"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@libs/shadcn-ui/components/ui/button";
import { Input } from "@libs/shadcn-ui/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@libs/shadcn-ui/components/ui/card";
import { Badge } from "@libs/shadcn-ui/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@libs/shadcn-ui/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@libs/shadcn-ui/components/ui/table";
import { Loader2, Send, Plus, Bot, User } from "lucide-react";
import { cn } from "@libs/shadcn-ui/lib/utils";
import { fetchAPI } from "../../../../../utils/api";
import { useWorkspace } from "../../../../../utils/workspaceContext";
import {
  createTestChat,
  sendUserMessageWithReply,
  getChatMessages,
  getChat,
  listWorkspaceChats,
  type Chat,
  type ChatMessage,
} from "../../../../../utils/chatApi";
import { listContacts, type Contact } from "../../../../../utils/contactApi";
import {
  getAgentConfig,
  listAgentTools,
  listIntents,
  type WorkspaceTool,
  type Intent,
} from "../../../../../utils/agentConfigApi";

interface AgentLite {
  id: string;
  name: string;
}

const STATUS_POLL_MS = 5000;

export default function WorkspaceChatsPage() {
  const routeParams = useParams<{ workspaceId: string }>();
  const workspaceId = (routeParams?.workspaceId as string) || "";
  const { activeWorkspace } = useWorkspace();

  // Soft, client-side-only gate — matches how this dashboard already treats
  // "admin of the workspace" elsewhere (Billing/Members are visible to all
  // members; only genuinely sensitive data, like contact search below, is
  // backend-enforced). Role strings are lowercase at runtime.
  const isWorkspaceAdmin = ["admin", "owner"].includes((activeWorkspace?.role || "").toLowerCase());

  const [agents, setAgents] = useState<AgentLite[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");

  // Picker state
  const [contactQuery, setContactQuery] = useState("");
  const [contactResults, setContactResults] = useState<Contact[]>([]);
  const [searchingContacts, setSearchingContacts] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [newPhone, setNewPhone] = useState("");
  const [starting, setStarting] = useState(false);

  // Live chat state
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  // History
  const [history, setHistory] = useState<Chat[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Tool/intent visibility (informational only — no new config model)
  const [attachedTools, setAttachedTools] = useState<WorkspaceTool[]>([]);
  const [attachedIntents, setAttachedIntents] = useState<Intent[]>([]);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    (async () => {
      try {
        const list = (await fetchAPI(`/v1/agents?workspaceId=${workspaceId}`)) as AgentLite[];
        setAgents(list || []);
        if (list?.length) setSelectedAgentId(list[0].id);
      } catch {
        // agent list failure surfaces via the empty picker; nothing else to do here
      }
    })();
  }, [workspaceId]);

  const refreshHistory = useCallback(async () => {
    if (!selectedAgentId) return;
    setLoadingHistory(true);
    try {
      const list = await listWorkspaceChats(selectedAgentId);
      setHistory(list);
    } catch {
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [selectedAgentId]);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  useEffect(() => {
    if (!selectedAgentId) {
      setAttachedTools([]);
      setAttachedIntents([]);
      return;
    }
    (async () => {
      try {
        const [config, tools, intents] = await Promise.all([
          getAgentConfig(selectedAgentId),
          listAgentTools(selectedAgentId),
          listIntents(selectedAgentId),
        ]);
        setAttachedTools(tools.filter((t) => config.toolIds?.includes(t.id)));
        setAttachedIntents(intents.filter((i) => config.intentIds?.includes(i.id)));
      } catch {
        setAttachedTools([]);
        setAttachedIntents([]);
      }
    })();
  }, [selectedAgentId]);

  // Contact search — debounced, only meaningful for admin/owner (backend
  // 403s otherwise; a non-admin can still type a raw phone number below).
  useEffect(() => {
    if (!isWorkspaceAdmin || !contactQuery.trim()) {
      setContactResults([]);
      return;
    }
    setSearchingContacts(true);
    const handle = setTimeout(async () => {
      try {
        const { contacts } = await listContacts(contactQuery.trim());
        setContactResults(contacts);
      } catch {
        setContactResults([]);
      } finally {
        setSearchingContacts(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [contactQuery, isWorkspaceAdmin]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback((chatId: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      const [latestChat, latestMessages] = await Promise.all([getChat(chatId), getChatMessages(chatId)]);
      if (latestChat) setChat(latestChat);
      setMessages(latestMessages);
      if (latestChat?.status === "terminated") stopPolling();
    }, STATUS_POLL_MS);
  }, [stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const handleStart = useCallback(async () => {
    if (!selectedAgentId) return;
    setStarting(true);
    try {
      const externalId = selectedContact?.externalId || newPhone.trim();
      const created = await createTestChat({
        agentId: selectedAgentId,
        name: `Test chat ${new Date().toLocaleString()}`,
        contactExternalId: externalId || undefined,
        channel: "phone",
      });
      if (!created) return;
      setChat(created);
      setMessages([]);
      startPolling(created.id);
    } finally {
      setStarting(false);
    }
  }, [selectedAgentId, selectedContact, newPhone, startPolling]);

  const handleStartFresh = useCallback(() => {
    stopPolling();
    setChat(null);
    setMessages([]);
    setSelectedContact(null);
    setNewPhone("");
    setContactQuery("");
    refreshHistory();
  }, [stopPolling, refreshHistory]);

  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content || !chat || sending || chat.status === "terminated") return;
    setInput("");
    setSending(true);
    const optimisticId = `temp-${Date.now()}`;
    setMessages((prev) => [...prev, { id: optimisticId, role: "user", content, sequenceId: prev.length, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]);
    try {
      const result = await sendUserMessageWithReply(chat.id, content);
      setMessages((prev) => {
        const withoutOptimistic = prev.filter((m) => m.id !== optimisticId);
        return [...withoutOptimistic, result.user, ...(result.assistant ? [result.assistant] : [])];
      });
    } finally {
      setSending(false);
    }
  }, [input, chat, sending]);

  const toolNameById = useMemo(() => {
    const map = new Map<string, string>();
    attachedTools.forEach((t) => map.set(t.id, t.name));
    return map;
  }, [attachedTools]);

  const exercisedToolNames = useMemo(() => {
    const names = new Set<string>();
    messages.forEach((m) => {
      const calls = (m.metadata?.toolCalls as Array<{ toolId: string; name: string }> | undefined) || [];
      calls.forEach((c) => names.add(toolNameById.get(c.toolId) || c.name));
    });
    return Array.from(names);
  }, [messages, toolNameById]);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">Chats</h1>
        <p className="text-sm text-muted-foreground">
          Test an agent as a specific customer persona, and watch how it responds.
        </p>
      </div>

      {!isWorkspaceAdmin && (
        <Card className="border-dashed">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Searching existing contacts is limited to workspace admins/owners. You can still start a test
            chat below by typing a new phone number.
          </CardContent>
        </Card>
      )}

      {!chat ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Start a test chat</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Agent</label>
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Persona / phone number</label>
              {isWorkspaceAdmin && (
                <div className="relative">
                  <Input
                    placeholder="Search existing contacts…"
                    value={contactQuery}
                    onChange={(e) => {
                      setContactQuery(e.target.value);
                      setSelectedContact(null);
                    }}
                  />
                  {searchingContacts && <Loader2 className="h-3.5 w-3.5 animate-spin absolute right-2 top-2.5" />}
                  {contactResults.length > 0 && !selectedContact && (
                    <div className="border rounded-md mt-1 max-h-40 overflow-y-auto bg-background shadow-sm">
                      {contactResults.map((c) => (
                        <button
                          key={c.id}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                          onClick={() => {
                            setSelectedContact(c);
                            setContactQuery(c.displayName ? `${c.displayName} (${c.externalId})` : c.externalId);
                            setContactResults([]);
                          }}
                        >
                          {c.displayName ? `${c.displayName} — ` : ""}
                          {c.externalId}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-muted-foreground">or new number:</span>
                <Input
                  placeholder="+2547..."
                  value={newPhone}
                  onChange={(e) => {
                    setNewPhone(e.target.value);
                    setSelectedContact(null);
                  }}
                  className="max-w-[200px]"
                />
              </div>
            </div>

            <Button onClick={handleStart} disabled={!selectedAgentId || starting}>
              {starting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Start test chat
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">{chat.name || "Test chat"}</CardTitle>
              {chat.status && (
                <Badge variant="outline" className="mt-1 text-xs">
                  {chat.status}
                </Badge>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={handleStartFresh}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Start fresh
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {(attachedIntents.length > 0 || attachedTools.length > 0) && (
              <div className="text-xs text-muted-foreground border rounded-md p-2 space-y-1">
                <div>
                  <span className="font-medium">Attached intents:</span>{" "}
                  {attachedIntents.length ? attachedIntents.map((i) => i.name).join(", ") : "none"}
                </div>
                <div>
                  <span className="font-medium">Attached tools:</span>{" "}
                  {attachedTools.length ? attachedTools.map((t) => t.name).join(", ") : "none"}
                </div>
                <div>
                  <span className="font-medium">Exercised this conversation:</span>{" "}
                  {exercisedToolNames.length ? exercisedToolNames.join(", ") : "none yet"}
                </div>
              </div>
            )}

            <div className="space-y-3 max-h-[420px] overflow-y-auto border rounded-md p-3">
              {messages.map((m) => {
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
                        "h-8 w-8 rounded-lg shadow-sm flex items-center justify-center flex-shrink-0 text-xs",
                        isUser ? "bg-brand-green text-white" : "bg-card border border-border text-brand-green"
                      )}
                    >
                      {isUser ? <User className="h-4.5 w-4.5" /> : <Bot className="h-4.5 w-4.5" />}
                    </div>
                    <div
                      className={cn(
                        "max-w-[75%] rounded-lg px-4 py-2.5 text-xs leading-relaxed shadow-sm whitespace-pre-wrap",
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
            </div>

            {chat.status === "terminated" ? (
              <div className="text-xs text-center text-muted-foreground border rounded-md p-2">
                This chat has ended ({chat.disconnectReason || "terminated"}). Start a fresh one to continue testing.
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Type a message…"
                  disabled={sending}
                />
                <Button onClick={handleSend} disabled={sending || !input.trim()}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent test chats</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No test chats for this agent yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    onClick={async () => {
                      setChat(c);
                      setMessages(await getChatMessages(c.id));
                      if (c.status !== "terminated") startPolling(c.id);
                    }}
                  >
                    <TableCell>{c.name || c.sessionId}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {c.status || "active"}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(c.createdAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
