import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken } from 'livekit-server-sdk';

@Injectable()
export class LivekitService {
  private readonly logger = new Logger(LivekitService.name);
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly livekitUrl: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('LIVEKIT_API_KEY');
    this.apiSecret = this.configService.get<string>('LIVEKIT_API_SECRET');
    this.livekitUrl = this.configService.get<string>('LIVEKIT_URL');

    if (!this.apiKey || !this.apiSecret || !this.livekitUrl) {
      this.logger.warn('LiveKit configuration is incomplete. Some features may not work correctly.');
    } else {
      this.logger.log('LiveKit service initialized successfully');
    }
  }

  /**
   * Generate a token for a participant to join a room
   * @param identity Unique identifier for the participant
   * @param roomName Name of the room to join
   * @param metadata Optional metadata for the participant
   * @returns JWT token for LiveKit authentication
   */
  async generateToken(identity: string, roomName: string, metadata?: string): Promise<string> {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('LiveKit API key or secret is not configured');
    }

    const token = new AccessToken(this.apiKey, this.apiSecret, {
      identity,
      name: identity,
      metadata,
    });

    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    });

    return token.toJwt();
  }

  /**
   * Get the LiveKit server URL
   * @returns The LiveKit server URL
   */
  getLiveKitUrl(): string {
    return this.livekitUrl;
  }

  /**
   * Check if LiveKit is properly configured
   * @returns Boolean indicating if LiveKit configuration is valid
   */
  isConfigured(): boolean {
    return !!(this.apiKey && this.apiSecret && this.livekitUrl);
  }
}
