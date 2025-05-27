import { VoiceDTO } from '../dto/voice.dto';
import { Readable } from 'stream';

/**
 * Voice settings for text-to-speech conversion
 */
export interface TtsVoiceSettings {
  voiceId: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  speakerBoost?: boolean;
  modelId?: string;
}

export interface ITtsService {
  /**
   * Get all available voices from the TTS provider
   * @returns Promise with an array of voices
   */
  getVoices(): Promise<VoiceDTO[]>;
  
  /**
   * Convert text to speech and return audio buffer
   * @param text The text to convert to speech
   * @param settings Voice settings including voice ID and parameters
   * @returns Promise with audio buffer
   */
  textToSpeech(text: string, settings: TtsVoiceSettings): Promise<Buffer>;
  
  /**
   * Stream text to speech and return a readable stream
   * @param text The text to convert to speech
   * @param settings Voice settings including voice ID and parameters
   * @returns Promise with a readable stream
   */
  streamTextToSpeech(text: string, settings: TtsVoiceSettings): Promise<Readable>;
}

export const ITtsService = Symbol('ITtsService');
