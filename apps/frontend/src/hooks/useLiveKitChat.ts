import { useState, useEffect, useCallback } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';
import { fetchAPI } from '../utils/api';

export interface ChatMessage {
  role: 'user' | 'bot';
  text: string;
  timestamp: number;
}

export const useLiveKitChat = () => {
  const room = useRoomContext();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);

  // 1. Initial Load: Fetch History (Backend API)
  useEffect(() => {
    if (!room?.name) return;
    
    // The room name is "test-room" in local dev, or dynamic.
    // Our backend expects sessionId. In local dev, we often map roomName = sessionId.
    const sessionId = room.name;

    fetchAPI(`/v1/chats/${sessionId}/messages`)
      .then((hist: any[]) => {
        // Map backend format to UI format
        const mapped: ChatMessage[] = hist.map((msg) => ({
          role: (msg.role === 'user' ? 'user' : 'bot') as 'user' | 'bot',
          text: msg.content,
          timestamp: new Date(msg.createdAt).getTime(),
        }));
        setMessages(mapped);
      })
      .catch((err) => console.error("Failed to load chat history:", err));
  }, [room?.name]);

  // 2. Receive Real-Time Messages via Data Channel
  useEffect(() => {
    if (!room) return;

    const onDataReceived = (payload: Uint8Array, participant: any, kind: any, topic?: string) => {
      const decoder = new TextDecoder();
      const text = decoder.decode(payload);
      
      setMessages((prev) => [
        ...prev, 
        { role: 'bot', text, timestamp: Date.now() }
      ]);
    };

    room.on(RoomEvent.DataReceived, onDataReceived);

    return () => {
      room.off(RoomEvent.DataReceived, onDataReceived);
    };
  }, [room]);

  // 3. Send Message
  const sendMessage = useCallback(async (text: string) => {
    if (!room || !text.trim()) return;
    setIsSending(true);

    try {
        // Optimistic Update
        setMessages((prev) => [
            ...prev,
            { role: 'user', text, timestamp: Date.now() }
        ]);

        const encoder = new TextEncoder();
        const payload = encoder.encode(text);

        // Publish to room (reliable)
        await room.localParticipant.publishData(payload, {
            reliable: true,
        });

    } catch (e) {
        console.error("Failed to send message:", e);
    } finally {
        setIsSending(false);
    }
  }, [room]);

  return { messages, sendMessage, isSending };
};
