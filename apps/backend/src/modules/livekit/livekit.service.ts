import { Injectable, Logger } from '@nestjs/common';
import {
  AccessToken,
  RoomServiceClient,
  SipClient,
  type CreateSipInboundTrunkOptions,
  type CreateSipOutboundTrunkOptions,
  type SIPDispatchRuleInfo,
} from 'livekit-server-sdk';
// Not re-exported from livekit-server-sdk's own index (only the deprecated
// unified SIPTrunkInfo is) — pulled from @livekit/protocol directly, the
// same package livekit-server-sdk's own SipClient.d.ts imports these from.
import type { SIPInboundTrunkInfo, SIPOutboundTrunkInfo } from '@livekit/protocol';

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

  private _sip?: SipClient;
  private get sip(): SipClient {
    if (!this._sip) {
      this._sip = new SipClient(this.httpUrl, this.apiKey, this.apiSecret);
    }
    return this._sip;
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
    /** Persona phone number picked in the browser tester (FloatingAgentTester) —
     * optional. When set, factory.py falls back to this for `from_number` on
     * browser-originated calls (which have no sip.phoneNumber participant
     * attribute), so Contact resolution works for voice test calls too. */
    callerPhone?: string;
  }): Promise<VoiceSession> {
    const room = `voice_${params.agentId}_${params.sessionId}`;
    const identity = params.identity || `user_${params.sessionId}`;
    const metadata = JSON.stringify({
      agent_id: params.agentId,
      workspace_id: params.workspaceId,
      session_id: params.sessionId,
      ...(params.callerPhone ? { caller_phone: params.callerPhone } : {}),
    });

    await this.seedRoomMetadata(room, metadata);

    const token = await this.createToken(identity, room, JSON.stringify({ role: 'caller' }));
    return { token, url: this.wsUrl, room, identity };
  }

  /**
   * Create a room with the given metadata, or update it in place if the room
   * already exists — idempotent "make sure this room has this metadata"
   * primitive. Used both for browser-originated calls (startVoiceSession)
   * and to pre-seed a SIP-originated room's {agent_id, workspace_id,
   * phone_number_id} at PhoneNumber.assignAgent() time, before any call ever
   * lands, so the Python worker's existing room-metadata-read-on-join logic
   * works unchanged for both origins.
   */
  async seedRoomMetadata(room: string, metadata: string): Promise<void> {
    try {
      await this.rooms.createRoom({ name: room, metadata, emptyTimeout: 120, maxParticipants: 4 });
    } catch (err) {
      this.logger.warn(`createRoom(${room}) failed, attempting metadata update: ${(err as Error).message}`);
      try {
        await this.rooms.updateRoomMetadata(room, metadata);
      } catch (e) {
        // Logged, not thrown: matches this method's existing tolerant
        // behavior for browser calls, and PhoneNumber.assignAgent()'s own
        // documented failure mode (log for reconciliation, no rollback of
        // the DB write that already succeeded).
        this.logger.error(`updateRoomMetadata(${room}) failed: ${(e as Error).message}`);
      }
    }
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

  // ── SIP trunks / dispatch rules ──────────────────────────────────────────
  // Inbound and outbound trunks are genuinely separate LiveKit resources
  // (installed livekit-server-sdk@2.13.2) — the older unified
  // createSipTrunk/SIPTrunkInfo path is @deprecated in the SDK itself and
  // deliberately not used here.

  async createInboundTrunk(
    name: string,
    numbers: string[],
    opts?: CreateSipInboundTrunkOptions,
  ): Promise<SIPInboundTrunkInfo> {
    return this.sip.createSipInboundTrunk(name, numbers, opts);
  }

  async createOutboundTrunk(
    name: string,
    address: string,
    numbers: string[],
    opts: CreateSipOutboundTrunkOptions,
  ): Promise<SIPOutboundTrunkInfo> {
    return this.sip.createSipOutboundTrunk(name, address, numbers, opts);
  }

  async deleteTrunk(sipTrunkId: string): Promise<void> {
    await this.sip.deleteSipTrunk(sipTrunkId);
  }

  /**
   * One dispatch rule per PhoneNumber, routed straight to a fixed room —
   * lower latency than an Individual rule (no per-caller room-naming
   * indirection) and matches this codebase's one-number-one-room model.
   */
  async createDirectDispatchRule(
    trunkId: string,
    roomName: string,
    metadata?: string,
  ): Promise<SIPDispatchRuleInfo> {
    return this.sip.createSipDispatchRule(
      { type: 'direct', roomName },
      { trunkIds: [trunkId], metadata },
    );
  }

  async deleteDispatchRule(sipDispatchRuleId: string): Promise<void> {
    await this.sip.deleteSipDispatchRule(sipDispatchRuleId);
  }

  async listInboundTrunks(): Promise<SIPInboundTrunkInfo[]> {
    return this.sip.listSipInboundTrunk();
  }

  async listOutboundTrunks(): Promise<SIPOutboundTrunkInfo[]> {
    return this.sip.listSipOutboundTrunk();
  }
}
