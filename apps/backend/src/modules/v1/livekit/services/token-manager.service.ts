import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken } from 'livekit-server-sdk';

@Injectable()
export class TokenManagerService {
  private readonly logger = new Logger(TokenManagerService.name);
  private readonly apiKey: string;
  private readonly apiSecret: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('LIVEKIT_API_KEY');
    this.apiSecret = this.configService.get<string>('LIVEKIT_API_SECRET');

    if (!this.apiKey || !this.apiSecret) {
      this.logger.warn('LiveKit API key or secret is not configured. Token generation will not work correctly.');
    } else {
      this.logger.log('TokenManagerService initialized successfully');
    }
  }

  /**
   * Generate a token for a participant to join a room
   * @param identity Unique identifier for the participant
   * @param roomName Name of the room to join
   * @param metadata Optional metadata for the participant
   * @param ttl Time to live for the token in seconds (default: 1 hour)
   * @returns JWT token for LiveKit authentication
   */
  async generateToken(
    identity: string,
    roomName: string,
    metadata?: string,
    ttl: number = 3600,
  ): Promise<string> {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('LiveKit API key or secret is not configured');
    }

    const token = new AccessToken(this.apiKey, this.apiSecret, {
      identity,
      name: identity,
      metadata,
      ttl,
    });

    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    return token.toJwt();
  }

  /**
   * Generate a token with restricted permissions
   * @param identity Unique identifier for the participant
   * @param roomName Name of the room to join
   * @param canPublish Whether the participant can publish audio/video
   * @param canSubscribe Whether the participant can subscribe to other participants
   * @param metadata Optional metadata for the participant
   * @returns JWT token for LiveKit authentication
   */
  async generateRestrictedToken(
    identity: string,
    roomName: string,
    canPublish: boolean,
    canSubscribe: boolean,
    metadata?: string,
  ): Promise<string> {
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
      canPublish,
      canSubscribe,
      canPublishData: true,
    });

    return token.toJwt();
  }

  /**
   * Validate a token
   * @param token JWT token to validate
   * @returns Boolean indicating if the token is valid
   */
  validateToken(token: string): boolean {
    try {
      // This is a simple validation that the token is properly formatted
      // For actual validation, you would need to decode and verify the JWT
      return token.split('.').length === 3;
    } catch (error) {
      this.logger.error(`Failed to validate token: ${error.message}`);
      return false;
    }
  }
}
