import { Injectable } from '@nestjs/common';
import { AccessToken } from 'livekit-server-sdk';

@Injectable()
export class LiveKitService {
  private apiKey = process.env['LIVEKIT_API_KEY'] || 'devkey';
  private apiSecret = process.env['LIVEKIT_API_SECRET'] || 'devsecret';

  async createToken(participantName: string, roomName: string) {
    const at = new AccessToken(this.apiKey, this.apiSecret, {
      identity: participantName,
    });

    at.addGrant({ roomJoin: true, room: roomName });

    return await at.toJwt();
  }
}
