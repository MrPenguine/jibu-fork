import { Injectable } from '@nestjs/common';
import { ITtsService } from './interfaces/tts.interface';
import { VoiceDTO } from './dto/voice.dto';

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
}
