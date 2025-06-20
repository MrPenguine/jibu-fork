import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { STT_SERVICE_TOKEN } from '../../../../integrations/integrations.module';
import { ISttService } from '../../../../integrations/stt/interfaces/stt.interface';
import { WebSocket } from 'ws';

/**
 * Service for handling agent voice interactions with LiveKit
 */
@Injectable()
export class AgentVoiceService {
  private readonly logger = new Logger(AgentVoiceService.name);
  private activeSessions: Map<string, {
    sttSessionId: string,
    websocket: WebSocket,
    transcript: string,
    lastUpdate: number
  }> = new Map();

  constructor(
    @Inject(STT_SERVICE_TOKEN) private sttService: ISttService,
    private configService: ConfigService
  ) {}

  /**
   * Start a new voice session for a participant
   * @param participantId LiveKit participant ID
   * @param websocket WebSocket connection for real-time updates
   * @returns Session ID
   */
  async startVoiceSession(participantId: string, websocket: WebSocket): Promise<string> {
    try {
      // Start STT session
      const sttSessionId = await this.sttService.startContinuousTranscription();
      
      // Create session ID (using participant ID for simplicity)
      const sessionId = participantId;
      
      // Store session data
      this.activeSessions.set(sessionId, {
        sttSessionId,
        websocket,
        transcript: '',
        lastUpdate: Date.now()
      });
      
      this.logger.log(`Started voice session for participant: ${participantId}`);
      
      // Set up periodic transcript updates
      this.startTranscriptUpdates(sessionId);
      
      return sessionId;
    } catch (error) {
      this.logger.error(`Error starting voice session: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process audio data from a participant
   * @param sessionId Session ID
   * @param audioData Audio data as ArrayBuffer
   */
  async processAudioData(sessionId: string, audioData: ArrayBuffer): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    try {
      // Send audio data to STT service
      await this.sttService.addAudioChunk(session.sttSessionId, audioData);
      
      // Update last activity timestamp
      session.lastUpdate = Date.now();
      this.activeSessions.set(sessionId, session);
    } catch (error) {
      this.logger.error(`Error processing audio data for session ${sessionId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * End a voice session
   * @param sessionId Session ID
   * @returns Final transcript
   */
  async endVoiceSession(sessionId: string): Promise<string> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    try {
      // Get final transcript from STT service
      const finalTranscript = await this.sttService.endContinuousTranscription(session.sttSessionId);
      
      // Clean up resources
      session.websocket.close();
      this.activeSessions.delete(sessionId);
      
      this.logger.log(`Ended voice session for ${sessionId}`);
      
      return finalTranscript;
    } catch (error) {
      this.logger.error(`Error ending voice session ${sessionId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Start periodic transcript updates for a session
   * @param sessionId Session ID
   */
  private startTranscriptUpdates(sessionId: string): void {
    const updateInterval = setInterval(async () => {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        clearInterval(updateInterval);
        return;
      }
      
      try {
        // Get current transcript
        const currentTranscript = await this.sttService.getIntermediateTranscription(session.sttSessionId);
        
        // If transcript has changed, send update via WebSocket
        if (currentTranscript !== session.transcript) {
          session.transcript = currentTranscript;
          this.activeSessions.set(sessionId, session);
          
          // Send transcript update to client
          if (session.websocket.readyState === WebSocket.OPEN) {
            session.websocket.send(JSON.stringify({
              type: 'transcript',
              transcript: currentTranscript
            }));
          }
        }
        
        // Check for session timeout (5 minutes of inactivity)
        const inactivityThreshold = 5 * 60 * 1000; // 5 minutes in ms
        if (Date.now() - session.lastUpdate > inactivityThreshold) {
          this.logger.log(`Session ${sessionId} timed out due to inactivity`);
          this.endVoiceSession(sessionId).catch(err => {
            this.logger.error(`Error ending inactive session ${sessionId}: ${err.message}`);
          });
          clearInterval(updateInterval);
        }
      } catch (error) {
        this.logger.error(`Error updating transcript for session ${sessionId}: ${error.message}`);
      }
    }, 1000); // Update every second
  }
}
