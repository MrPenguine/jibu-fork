import { fetchAPI } from './api';

export interface VoiceSession {
  token: string;
  url: string;
  room: string;
  identity: string;
  agent: { id: string; name: string };
}

/** Start (or reuse) a voice room for an agent and get a caller token. */
export async function startVoiceSession(agentId: string): Promise<VoiceSession> {
  const session = await fetchAPI(`/livekit/voice/start?agentId=${encodeURIComponent(agentId)}`);
  if (!session?.token || !session?.url || !session?.room) {
    throw new Error('Voice session did not return a token/url/room.');
  }
  return session as VoiceSession;
}

/** Tear down a voice room on the LiveKit server. */
export async function endVoiceSession(room: string): Promise<void> {
  try {
    await fetchAPI('/livekit/voice/end', {
      method: 'POST',
      body: JSON.stringify({ room }),
    });
  } catch {
    // Best-effort: the room also auto-closes via emptyTimeout.
  }
}
