import { fetchAPI } from './api';

/**
 * Interface for LiveKit token request
 */
export interface TokenRequest {
  identity: string;
  roomName: string;
  metadata?: Record<string, any>;
}

/**
 * Interface for LiveKit token response
 */
export interface TokenResponse {
  token: string;
  url: string;
}

/**
 * Interface for creating a LiveKit room
 */
export interface CreateRoomRequest {
  roomName: string;
  metadata?: Record<string, any>;
  emptyOnCreate?: boolean;
}

/**
 * Interface for room information
 */
export interface RoomInfo {
  sid: string;
  name: string;
  emptyTimeout: number;
  maxParticipants: number;
  creationTime: number;
  turnPassword: string;
  enabledCodecs: any[];
  metadata?: string;
  numParticipants: number;
  activeRecording: boolean;
}

/**
 * Interface for participant information
 */
export interface ParticipantInfo {
  sid: string;
  identity: string;
  state: string;
  metadata?: string;
  joinedAt: number;
  name?: string;
  version: number;
  permission?: {
    canPublish: boolean;
    canSubscribe: boolean;
    canPublishData: boolean;
    hidden: boolean;
    recorder: boolean;
  };
  region?: string;
}

// All requests below use fetchAPI which attaches auth and X-Workspace-ID headers automatically.

/**
 * LiveKit API client functions
 */
export const livekitApiClient = {
  /**
   * Get a LiveKit token for joining a room
   * @param request Token request with identity and room name
   * @returns Promise with token and LiveKit server URL
   */
  async getToken(request: TokenRequest): Promise<TokenResponse> {
    try {
      return await fetchAPI('/v1/livekit/token', {
        method: 'POST',
        body: JSON.stringify(request)
      });
    } catch (error) {
      console.error('[livekitApi] Error getting token:', error);
      throw error;
    }
  },

  /**
   * Create a LiveKit room
   * @param request Room creation request
   * @returns Promise with room information
   */
  async createRoom(request: CreateRoomRequest): Promise<RoomInfo> {
    try {
      return await fetchAPI('/v1/livekit/rooms', {
        method: 'POST',
        body: JSON.stringify(request)
      });
    } catch (error) {
      console.error('[livekitApi] Error creating room:', error);
      throw error;
    }
  },

  /**
   * List all LiveKit rooms
   * @returns Promise with array of room information
   */
  async listRooms(): Promise<RoomInfo[]> {
    try {
      return await fetchAPI('/v1/livekit/rooms', {
        method: 'GET'
      });
    } catch (error) {
      console.error('[livekitApi] Error listing rooms:', error);
      throw error;
    }
  },

  /**
   * Delete a LiveKit room
   * @param roomName Name of the room to delete
   * @returns Promise with success status
   */
  async deleteRoom(roomName: string): Promise<{ success: boolean }> {
    try {
      return await fetchAPI(`/v1/livekit/rooms/${encodeURIComponent(roomName)}`, {
        method: 'DELETE'
      });
    } catch (error) {
      console.error('[livekitApi] Error deleting room:', error);
      throw error;
    }
  },

  /**
   * List participants in a LiveKit room
   * @param roomName Name of the room
   * @returns Promise with array of participant information
   */
  async listParticipants(roomName: string): Promise<ParticipantInfo[]> {
    try {
      return await fetchAPI(`/v1/livekit/room/${encodeURIComponent(roomName)}/participants`, {
        method: 'GET'
      });
    } catch (error) {
      console.error('[livekitApi] Error listing participants:', error);
      throw error;
    }
  },

  /**
   * Check LiveKit server health
   * @returns Promise with health status
   */
  async checkHealth(): Promise<{ status: string; configured: boolean; serverUrl: string }> {
    try {
      return await fetchAPI('/v1/livekit/health', {
        method: 'GET'
      });
    } catch (error) {
      console.error('[livekitApi] Error checking health:', error);
      return { status: 'error', configured: false, serverUrl: '' };
    }
  }
};

export default livekitApiClient;
