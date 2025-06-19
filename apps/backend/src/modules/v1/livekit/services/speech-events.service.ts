import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Subject } from 'rxjs';

// Define speech event types
export enum SpeechEventType {
  SPEECH_START = 'speech_start',
  SPEECH_END = 'speech_end',
  SILENCE_START = 'silence_start',
  SILENCE_END = 'silence_end',
  INTERRUPTION = 'interruption',
  DTMF = 'dtmf',
}

// Define speech event interface
export interface SpeechEvent {
  type: SpeechEventType;
  roomName: string;
  participantId: string;
  timestamp: number;
  data?: any;
}

@Injectable()
export class SpeechEventsService {
  private readonly logger = new Logger(SpeechEventsService.name);
  private speechEvents = new Subject<SpeechEvent>();

  constructor(private configService: ConfigService) {
    this.logger.log('SpeechEventsService initialized');
  }

  /**
   * Emit a speech event
   * @param event Speech event to emit
   */
  emitEvent(event: SpeechEvent): void {
    this.logger.debug(`Emitting speech event: ${event.type} from ${event.participantId} in room ${event.roomName}`);
    this.speechEvents.next(event);
  }

  /**
   * Subscribe to speech events
   * @param callback Callback function to handle speech events
   * @returns Subscription object
   */
  subscribeToEvents(callback: (event: SpeechEvent) => void) {
    return this.speechEvents.subscribe(callback);
  }

  /**
   * Emit a speech start event
   * @param roomName Room name
   * @param participantId Participant ID
   * @param audioLevel Audio level that triggered the event
   */
  emitSpeechStart(roomName: string, participantId: string, audioLevel?: number): void {
    this.emitEvent({
      type: SpeechEventType.SPEECH_START,
      roomName,
      participantId,
      timestamp: Date.now(),
      data: { audioLevel },
    });
  }

  /**
   * Emit a speech end event
   * @param roomName Room name
   * @param participantId Participant ID
   * @param duration Duration of speech in ms
   */
  emitSpeechEnd(roomName: string, participantId: string, duration?: number): void {
    this.emitEvent({
      type: SpeechEventType.SPEECH_END,
      roomName,
      participantId,
      timestamp: Date.now(),
      data: { duration },
    });
  }

  /**
   * Emit a silence start event
   * @param roomName Room name
   * @param participantId Participant ID
   */
  emitSilenceStart(roomName: string, participantId: string): void {
    this.emitEvent({
      type: SpeechEventType.SILENCE_START,
      roomName,
      participantId,
      timestamp: Date.now(),
    });
  }

  /**
   * Emit a silence end event
   * @param roomName Room name
   * @param participantId Participant ID
   * @param duration Duration of silence in ms
   */
  emitSilenceEnd(roomName: string, participantId: string, duration: number): void {
    this.emitEvent({
      type: SpeechEventType.SILENCE_END,
      roomName,
      participantId,
      timestamp: Date.now(),
      data: { duration },
    });
  }

  /**
   * Emit an interruption event
   * @param roomName Room name
   * @param interrupterId ID of the participant who interrupted
   * @param interruptedId ID of the participant who was interrupted
   */
  emitInterruption(roomName: string, interrupterId: string, interruptedId: string): void {
    this.emitEvent({
      type: SpeechEventType.INTERRUPTION,
      roomName,
      participantId: interrupterId,
      timestamp: Date.now(),
      data: { interruptedId },
    });
  }

  /**
   * Emit a DTMF event
   * @param roomName Room name
   * @param participantId Participant ID
   * @param digit DTMF digit
   */
  emitDtmf(roomName: string, participantId: string, digit: string): void {
    this.emitEvent({
      type: SpeechEventType.DTMF,
      roomName,
      participantId,
      timestamp: Date.now(),
      data: { digit },
    });
  }
}
