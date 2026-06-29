"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
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
import { Button } from "@libs/shadcn-ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@libs/shadcn-ui/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@libs/shadcn-ui/components/ui/select";
import { Mic, MicOff, PhoneCall, PhoneOff, Loader2 } from "lucide-react";
import { fetchAPI } from "../../../../../utils/api";
import { startVoiceSession, endVoiceSession, type VoiceSession } from "../../../../../utils/livekitVoiceApi";

interface AgentLite {
  id: string;
  name: string;
}

interface TranscriptLine {
  id: string;
  speaker: "agent" | "you";
  text: string;
  final: boolean;
}

export default function CallsPage() {
  const routeParams = useParams<{ workspaceId: string }>();
  const workspaceId = (routeParams?.workspaceId as string) || "";

  const [agents, setAgents] = useState<AgentLite[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [session, setSession] = useState<VoiceSession | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    (async () => {
      try {
        const list = (await fetchAPI(`/v1/agents?workspaceId=${workspaceId}`)) as AgentLite[];
        setAgents(list || []);
        if (list?.length) setSelectedAgentId(list[0].id);
      } catch (e: any) {
        setError(e?.message || "Failed to load agents");
      }
    })();
  }, [workspaceId]);

  const handleStart = useCallback(async () => {
    if (!selectedAgentId) return;
    setConnecting(true);
    setError(null);
    try {
      const s = await startVoiceSession(selectedAgentId);
      setSession(s);
    } catch (e: any) {
      setError(e?.message || "Could not start the call");
    } finally {
      setConnecting(false);
    }
  }, [selectedAgentId]);

  const handleEnd = useCallback(async () => {
    const room = session?.room;
    setSession(null);
    if (room) await endVoiceSession(room);
  }, [session]);

  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === selectedAgentId),
    [agents, selectedAgentId]
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full flex-col items-center px-4 py-6">
      <div className="w-full max-w-2xl">
        <h1 className="mb-1 text-2xl font-semibold text-[#22262A]">Calls</h1>
        <p className="mb-6 text-sm text-gray-500">
          Start a live voice call with one of your agents. Pick an agent and connect — the agent
          answers in the room with its configured voice, model and tools.
        </p>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {!session ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Connect to an agent</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Agent</label>
                <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                  <SelectTrigger>
                    <SelectValue placeholder={agents.length ? "Select an agent" : "No agents found"} />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name || a.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleStart}
                disabled={!selectedAgentId || connecting}
                className="w-full bg-[#009959] hover:bg-[#00824c]"
              >
                {connecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Connecting…
                  </>
                ) : (
                  <>
                    <PhoneCall className="mr-2 h-4 w-4" /> Start call
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <LiveKitRoom
            serverUrl={session.url}
            token={session.token}
            connect
            audio
            video={false}
            onDisconnected={handleEnd}
            data-lk-theme="default"
            className="rounded-xl border border-gray-200 bg-white"
          >
            <RoomAudioRenderer />
            <CallStage agentName={selectedAgent?.name || session.agent?.name || "Agent"} onEnd={handleEnd} />
          </LiveKitRoom>
        )}
      </div>
    </div>
  );
}

function CallStage({ agentName, onEnd }: { agentName: string; onEnd: () => void }) {
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
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-500">In call with</div>
          <div className="text-lg font-semibold text-[#22262A]">{agentName}</div>
        </div>
        <span className="rounded-full bg-[#E6F7F0] px-3 py-1 text-xs font-medium capitalize text-[#009959]">
          {state || "connecting"}
        </span>
      </div>

      <div className="flex h-28 items-center justify-center rounded-lg bg-gray-50">
        <BarVisualizer
          state={state}
          barCount={7}
          trackRef={audioTrack}
          className="h-20 w-64"
          options={{ minHeight: 8 }}
        />
      </div>

      <div
        ref={scrollRef}
        className="h-56 space-y-2 overflow-y-auto rounded-lg border border-gray-100 bg-white p-3"
      >
        {lines.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            Say hello — the live transcript will appear here.
          </div>
        ) : (
          lines.map((l) => (
            <div key={l.id} className={l.speaker === "you" ? "text-right" : "text-left"}>
              <span
                className={
                  "inline-block max-w-[80%] rounded-lg px-3 py-1.5 text-sm " +
                  (l.speaker === "you"
                    ? "bg-[#009959] text-white"
                    : "bg-gray-100 text-[#22262A]")
                }
              >
                {l.text}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" onClick={toggleMic} className="gap-2">
          {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          {micOn ? "Mute" : "Unmute"}
        </Button>
        <Button onClick={onEnd} className="gap-2 bg-red-600 hover:bg-red-700">
          <PhoneOff className="h-4 w-4" /> End call
        </Button>
      </div>
    </div>
  );
}
