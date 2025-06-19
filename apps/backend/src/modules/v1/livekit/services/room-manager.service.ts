import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RoomServiceClient } from 'livekit-server-sdk';

@Injectable()
export class RoomManagerService {
  private readonly logger = new Logger(RoomManagerService.name);
  private roomServiceClient: RoomServiceClient;

  constructor(private configService: ConfigService) {
    const livekitUrl = this.configService.get<string>('LIVEKIT_URL');
    const apiKey = this.configService.get<string>('LIVEKIT_API_KEY');
    const apiSecret = this.configService.get<string>('LIVEKIT_API_SECRET');

    if (livekitUrl && apiKey && apiSecret) {
      this.roomServiceClient = new RoomServiceClient(
        livekitUrl,
        apiKey,
        apiSecret,
      );
      this.logger.log('RoomManagerService initialized successfully');
    } else {
      this.logger.warn('LiveKit configuration is incomplete. Room management features will not work correctly.');
    }
  }

  /**
   * Create a new room or get an existing one
   * @param roomName Name of the room to create
   * @param metadata Optional metadata for the room
   * @param emptyOnCreate Whether to empty the room on creation
   * @returns Room details
   */
  async createOrGetRoom(roomName: string, metadata?: string, emptyOnCreate = false) {
    if (!this.roomServiceClient) {
      throw new Error('RoomServiceClient is not initialized');
    }

    try {
      // Create room options
      const createOptions = {
        name: roomName,
        emptyTimeout: 60 * 30, // 30 minutes
        maxParticipants: 10,
        metadata,
      };
      
      // If emptyOnCreate is true, empty the room after creation
      const room = await this.roomServiceClient.createRoom(createOptions);
      
      if (emptyOnCreate) {
        try {
          // If emptyOnCreate is true, we'll try to remove all participants
          // Get all participants first, then remove them one by one
          const participants = await this.roomServiceClient.listParticipants(roomName);
          
          for (const participant of participants) {
            await this.roomServiceClient.removeParticipant(roomName, participant.identity);
          }
          
          this.logger.log(`Room ${roomName} emptied as requested (${participants.length} participants removed)`);
        } catch (emptyError) {
          this.logger.warn(`Failed to empty room ${roomName}: ${emptyError.message}`);
        }
      }

      this.logger.log(`Room ${roomName} created or retrieved successfully`);
      return room;
    } catch (error) {
      this.logger.error(`Failed to create or get room ${roomName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * List all active rooms
   * @returns List of active rooms
   */
  async listRooms() {
    if (!this.roomServiceClient) {
      throw new Error('RoomServiceClient is not initialized');
    }

    try {
      const rooms = await this.roomServiceClient.listRooms();
      this.logger.log(`Listed ${rooms.length} active rooms`);
      return rooms;
    } catch (error) {
      this.logger.error(`Failed to list rooms: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete a room
   * @param roomName Name of the room to delete
   */
  async deleteRoom(roomName: string) {
    if (!this.roomServiceClient) {
      throw new Error('RoomServiceClient is not initialized');
    }

    try {
      await this.roomServiceClient.deleteRoom(roomName);
      this.logger.log(`Room ${roomName} deleted successfully`);
      return { success: true, message: `Room ${roomName} deleted successfully` };
    } catch (error) {
      this.logger.error(`Failed to delete room ${roomName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get participants in a room
   * @param roomName Name of the room
   * @returns List of participants in the room
   */
  async listParticipants(roomName: string) {
    if (!this.roomServiceClient) {
      throw new Error('RoomServiceClient is not initialized');
    }

    try {
      const participants = await this.roomServiceClient.listParticipants(roomName);
      this.logger.log(`Listed ${participants.length} participants in room ${roomName}`);
      return participants;
    } catch (error) {
      this.logger.error(`Failed to list participants in room ${roomName}: ${error.message}`);
      throw error;
    }
  }
}
