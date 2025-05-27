import { Injectable } from '@nestjs/common';
import { ITtsService, TtsVoiceSettings } from './interfaces/tts.interface';
import { VoiceDTO } from './dto/voice.dto';
import { Readable } from 'stream';

/**
 * Main TTS service that delegates to the appropriate provider
 */
@Injectable()
export class TtsService implements ITtsService {
  constructor(private readonly ttsProvider: ITtsService) {}

  /**
   * Get all available voices from the TTS provider
   * @returns Promise with an array of voices
   */
  async getVoices(): Promise<VoiceDTO[]> {
    return this.ttsProvider.getVoices();
  }
  
  /**
   * Convert text to speech using the configured TTS provider
   * @param text The text to convert to speech
   * @param settings Voice settings including voice ID and parameters
   * @returns Promise with audio buffer
   */
  async textToSpeech(text: string, settings: TtsVoiceSettings): Promise<Buffer> {
    return this.ttsProvider.textToSpeech(text, settings);
  }
  
  /**
   * Stream text to speech using the configured TTS provider
   * @param text The text to convert to speech
   * @param settings Voice settings including voice ID and parameters
   * @returns Promise with a readable stream
   */
  async streamTextToSpeech(text: string, settings: TtsVoiceSettings): Promise<Readable> {
    return this.ttsProvider.streamTextToSpeech(text, settings);
  }
}
