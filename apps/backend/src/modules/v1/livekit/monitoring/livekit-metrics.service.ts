import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Counter, Gauge, Registry } from 'prom-client';

@Injectable()
export class LivekitMetricsService implements OnModuleInit {
  private readonly logger = new Logger(LivekitMetricsService.name);
  private registry: Registry;
  
  // Metrics
  private activeRooms: Gauge<string>;
  private activeParticipants: Gauge<string>;
  private roomCreationCounter: Counter<string>;
  private participantJoinCounter: Counter<string>;
  private audioPacketsCounter: Counter<string>;
  private connectionErrorCounter: Counter<string>;

  constructor(private configService: ConfigService) {
    this.registry = new Registry();
    
    // Initialize metrics
    this.activeRooms = new Gauge({
      name: 'livekit_active_rooms',
      help: 'Number of active LiveKit rooms',
      registers: [this.registry],
    });

    this.activeParticipants = new Gauge({
      name: 'livekit_active_participants',
      help: 'Number of active participants in LiveKit rooms',
      labelNames: ['room'],
      registers: [this.registry],
    });

    this.roomCreationCounter = new Counter({
      name: 'livekit_room_creations_total',
      help: 'Total number of LiveKit room creations',
      registers: [this.registry],
    });

    this.participantJoinCounter = new Counter({
      name: 'livekit_participant_joins_total',
      help: 'Total number of participant joins in LiveKit rooms',
      labelNames: ['room'],
      registers: [this.registry],
    });

    this.audioPacketsCounter = new Counter({
      name: 'livekit_audio_packets_total',
      help: 'Total number of audio packets processed',
      labelNames: ['room', 'participant', 'direction'],
      registers: [this.registry],
    });

    this.connectionErrorCounter = new Counter({
      name: 'livekit_connection_errors_total',
      help: 'Total number of connection errors',
      labelNames: ['type'],
      registers: [this.registry],
    });

    this.logger.log('LivekitMetricsService initialized');
  }

  onModuleInit() {
    // Reset metrics on startup
    this.activeRooms.reset();
    this.activeParticipants.reset();
    
    this.logger.log('LiveKit metrics reset on startup');
  }

  /**
   * Get the Prometheus registry
   * @returns Prometheus registry
   */
  getRegistry(): Registry {
    return this.registry;
  }

  /**
   * Update the number of active rooms
   * @param count Number of active rooms
   */
  updateActiveRooms(count: number): void {
    this.activeRooms.set(count);
  }

  /**
   * Update the number of active participants in a room
   * @param roomName Room name
   * @param count Number of active participants
   */
  updateActiveParticipants(roomName: string, count: number): void {
    this.activeParticipants.set({ room: roomName }, count);
  }

  /**
   * Increment the room creation counter
   */
  incrementRoomCreations(): void {
    this.roomCreationCounter.inc();
  }

  /**
   * Increment the participant join counter
   * @param roomName Room name
   */
  incrementParticipantJoins(roomName: string): void {
    this.participantJoinCounter.inc({ room: roomName });
  }

  /**
   * Increment the audio packets counter
   * @param roomName Room name
   * @param participantId Participant ID
   * @param direction Direction of audio packets ('sent' or 'received')
   * @param count Number of packets to increment by
   */
  incrementAudioPackets(
    roomName: string,
    participantId: string,
    direction: 'sent' | 'received',
    count: number = 1,
  ): void {
    this.audioPacketsCounter.inc(
      { room: roomName, participant: participantId, direction },
      count,
    );
  }

  /**
   * Increment the connection error counter
   * @param errorType Type of connection error
   */
  incrementConnectionErrors(errorType: string): void {
    this.connectionErrorCounter.inc({ type: errorType });
  }

  /**
   * Get all metrics in Prometheus format
   * @returns Metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    return await this.registry.metrics();
  }
}
