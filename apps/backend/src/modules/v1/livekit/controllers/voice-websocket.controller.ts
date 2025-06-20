import { 
  WebSocketGateway, 
  WebSocketServer, 
  SubscribeMessage, 
  OnGatewayConnection, 
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { Logger } from '@nestjs/common';
import { AgentVoiceService } from '../services/agent-voice.service';

@WebSocketGateway({
  path: '/v1/livekit/voice-stream',
  cors: true
})
export class VoiceWebsocketController implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(VoiceWebsocketController.name);
  private clients: Map<WebSocket, { participantId: string, sessionId?: string }> = new Map();

  @WebSocketServer()
  server: Server;

  constructor(private agentVoiceService: AgentVoiceService) {}

  async handleConnection(client: WebSocket, request: Request): Promise<void> {
    // Extract participant ID from query params
    const url = new URL(request.url, 'http://localhost');
    const participantId = url.searchParams.get('participantId');
    
    if (!participantId) {
      this.logger.warn('Client attempted to connect without participantId');
      client.close(1008, 'Missing participantId');
      return;
    }
    
    // Store client info
    this.clients.set(client, { participantId });
    this.logger.log(`Client connected: ${participantId}`);
    
    // Send connection acknowledgement
    client.send(JSON.stringify({ 
      type: 'connected', 
      message: 'Connected to voice stream service' 
    }));
  }

  async handleDisconnect(client: WebSocket): Promise<void> {
    const clientInfo = this.clients.get(client);
    if (clientInfo) {
      this.logger.log(`Client disconnected: ${clientInfo.participantId}`);
      
      // End voice session if active
      if (clientInfo.sessionId) {
        try {
          await this.agentVoiceService.endVoiceSession(clientInfo.sessionId);
        } catch (error) {
          this.logger.error(`Error ending voice session on disconnect: ${error.message}`);
        }
      }
      
      this.clients.delete(client);
    }
  }

  @SubscribeMessage('start_transcription')
  async handleStartTranscription(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() data: any
  ): Promise<void> {
    const clientInfo = this.clients.get(client);
    if (!clientInfo) {
      client.send(JSON.stringify({ 
        type: 'error', 
        message: 'Client not registered' 
      }));
      return;
    }
    
    try {
      // Start voice session
      const sessionId = await this.agentVoiceService.startVoiceSession(
        clientInfo.participantId, 
        client
      );
      
      // Update client info with session ID
      clientInfo.sessionId = sessionId;
      this.clients.set(client, clientInfo);
      
      // Send acknowledgement
      client.send(JSON.stringify({ 
        type: 'transcription_started', 
        sessionId 
      }));
    } catch (error) {
      this.logger.error(`Error starting transcription: ${error.message}`);
      client.send(JSON.stringify({ 
        type: 'error', 
        message: 'Failed to start transcription' 
      }));
    }
  }

  @SubscribeMessage('audio_data')
  async handleAudioData(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() data: { audioData: ArrayBuffer }
  ): Promise<void> {
    const clientInfo = this.clients.get(client);
    if (!clientInfo || !clientInfo.sessionId) {
      client.send(JSON.stringify({ 
        type: 'error', 
        message: 'No active transcription session' 
      }));
      return;
    }
    
    try {
      // Process audio data
      await this.agentVoiceService.processAudioData(
        clientInfo.sessionId, 
        data.audioData
      );
    } catch (error) {
      this.logger.error(`Error processing audio data: ${error.message}`);
    }
  }

  @SubscribeMessage('stop_transcription')
  async handleStopTranscription(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() data: any
  ): Promise<void> {
    const clientInfo = this.clients.get(client);
    if (!clientInfo || !clientInfo.sessionId) {
      client.send(JSON.stringify({ 
        type: 'error', 
        message: 'No active transcription session' 
      }));
      return;
    }
    
    try {
      // End voice session
      const finalTranscript = await this.agentVoiceService.endVoiceSession(
        clientInfo.sessionId
      );
      
      // Update client info
      clientInfo.sessionId = undefined;
      this.clients.set(client, clientInfo);
      
      // Send final transcript
      client.send(JSON.stringify({ 
        type: 'transcription_ended', 
        transcript: finalTranscript 
      }));
    } catch (error) {
      this.logger.error(`Error stopping transcription: ${error.message}`);
      client.send(JSON.stringify({ 
        type: 'error', 
        message: 'Failed to stop transcription' 
      }));
    }
  }
}
