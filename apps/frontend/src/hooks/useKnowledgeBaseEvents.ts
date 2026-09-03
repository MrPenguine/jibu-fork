"use client";

import { useEffect, useRef, useState } from 'react';
import {
  knowledgeBaseEventsStreamUrl,
  listKnowledgeBaseEvents,
  type SourceEvent,
} from '../utils/knowledgebaseApi';

const MAX_EVENTS = 200;

export function useKnowledgeBaseEvents(knowledgeBaseId: string | null) {
  const [eventsBySource, setEventsBySource] = useState<Record<string, SourceEvent[]>>({});
  const [latestBySource, setLatestBySource] = useState<Record<string, SourceEvent>>({});
  const [connected, setConnected] = useState(false);
  const lastSeen = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!knowledgeBaseId) return;
    let stream: EventSource | null = null;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const addEvents = (incoming: SourceEvent[]) => {
      if (!incoming.length) return;
      setEventsBySource((previous) => {
        const next = { ...previous };
        incoming.forEach((event) => {
          const list = [...(next[event.sourceId] || []).filter((item) => item.id !== event.id), event];
          next[event.sourceId] = list.slice(-MAX_EVENTS);
        });
        return next;
      });
      setLatestBySource((previous) => {
        const next = { ...previous };
        incoming.forEach((event) => {
          if (!next[event.sourceId] || next[event.sourceId].createdAt <= event.createdAt) {
            next[event.sourceId] = event;
          }
          if (!lastSeen.current || lastSeen.current < event.createdAt) lastSeen.current = event.createdAt;
        });
        return next;
      });
    };
    const catchUp = async () => {
      const since = lastSeen.current || new Date(Date.now() - 10 * 60 * 1000).toISOString();
      try { addEvents(await listKnowledgeBaseEvents(knowledgeBaseId, { since })); } catch {}
    };
    const openStream = () => {
      if (stopped) return;
      stream = new EventSource(knowledgeBaseEventsStreamUrl(knowledgeBaseId), { withCredentials: true });
      stream.onopen = () => { setConnected(true); void catchUp(); };
      stream.addEventListener('source-event', (message) => {
        try { addEvents([JSON.parse((message as MessageEvent).data)]); } catch {}
      });
      stream.onerror = () => {
        setConnected(false);
        stream?.close();
        stream = null;
        void catchUp();
        if (!pollTimer) {
          pollTimer = setInterval(() => void catchUp(), 5000);
        }
        retryTimer = setTimeout(() => {
          if (pollTimer) clearInterval(pollTimer);
          pollTimer = undefined;
          openStream();
        }, 30000);
      };
    };
    openStream();
    return () => {
      stopped = true;
      setConnected(false);
      stream?.close();
      if (pollTimer) clearInterval(pollTimer);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [knowledgeBaseId]);

  return { eventsBySource, latestBySource, connected };
}
