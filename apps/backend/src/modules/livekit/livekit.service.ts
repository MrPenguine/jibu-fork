import { Injectable, Logger } from '@nestjs/common';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';

export interface VoiceSession {
  token: string;
  url: string;
  room: string;
  identity: string;
}

/**
 * Thin wrapper around the LiveKit server SDK: mints participant access tokens and
 * manages voice rooms (create-with-metadata / list / delete / participants). The
 * room metadata carries `{ agent_id, workspace_id, session_id }`, which the Python
 * voice worker reads on join to configure itself as the selected agent.
 */
@Injectable()
export class LiveKitService {
  private readonly logger = new Logger(LiveKitService.name);
  private apiKey = process.env['LIVEKIT_API_KEY'] || 'devkey';
  private apiSecret = process.env['LIVEKIT_API_SECRET'] || 'devsecret';
  // wss://host -> https://host for the REST RoomService client.
  private wsUrl = process.env['LIVEKIT_URL'] || 'ws://localhost:7880';
  private httpUrl = this.wsUrl.replace(/^ws/, 'http');

  private _rooms?: RoomServiceClient;
  private get rooms(): RoomServiceClient {
    if (!this._rooms) {
      this._rooms = new RoomServiceClient(this.httpUrl, this.apiKey, this.apiSecret);
    }
    return this._rooms;
  }

  async createToken(participantName: string, roomName: string, metadata?: string) {
    const at = new AccessToken(this.apiKey, this.apiSecret, {
      identity: participantName,
      metadata,
    });
    at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
    return await at.toJwt();
  }

  /**
   * Create (or reuse) a voice room whose metadata routes the Python worker to a
   * specific agent, then mint a browser participant token for it.
   */
  async startVoiceSession(params: {
    agentId: string;
    workspaceId: string;
    sessionId: string;
    identity?: string;
  }): Promise<VoiceSession> {
    const room = `voice_${params.agentId}_${params.sessionId}`;
    const identity = params.identity || `user_${params.sessionId}`;
    const metadata = JSON.stringify({
      agent_id: params.agentId,
      workspace_id: params.workspaceId,
      session_id: params.sessionId,
    });

    try {
      await this.rooms.createRoom({ name: room, metadata, emptyTimeout: 120, maxParticipants: 4 });
    } catch (err) {
      // Room may already exist (idempotent start) — update its metadata instead.
      this.logger.warn(`createRoom(${room}) failed, attempting metadata update: ${(err as Error).message}`);
      try {
        await this.rooms.updateRoomMetadata(room, metadata);
      } catch (e) {
        this.logger.error(`updateRoomMetadata(${room}) failed: ${(e as Error).message}`);
      }
    }

    const token = await this.createToken(identity, room, JSON.stringify({ role: 'caller' }));
    return { token, url: this.wsUrl, room, identity };
  }

  async listRooms() {
    const rooms = await this.rooms.listRooms();
    return rooms.map((r) => ({
      name: r.name,
      sid: r.sid,
      numParticipants: r.numParticipants,
      metadata: r.metadata,
      creationTime: Number(r.creationTime),
    }));
  }

  async listParticipants(room: string) {
    const participants = await this.rooms.listParticipants(room);
    return participants.map((p) => ({
      identity: p.identity,
      name: p.name,
      state: p.state,
      isPublisher: p.permission?.canPublish ?? false,
      metadata: p.metadata,
    }));
  }

  async deleteRoom(room: string) {
    await this.rooms.deleteRoom(room);
    return { ok: true, room };
  }

  health() {
    return { ok: true, url: this.wsUrl, configured: this.apiKey !== 'devkey' };
  }
}
