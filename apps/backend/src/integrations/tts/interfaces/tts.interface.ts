import { VoiceDTO } from '../dto/voice.dto';

export interface ITtsService {
  /**
   * Get all available voices from the TTS provider
   * @returns Promise with an array of voices
   */
  getVoices(): Promise<VoiceDTO[]>;
}

export const ITtsService = Symbol('ITtsService');
