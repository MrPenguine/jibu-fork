import { ConfigService } from '@nestjs/config';
import { TtsService } from './tts.service';
import { ElevenLabsTtsService } from './providers/elevenlabs/elevenlabs-tts.service';

/**
 * Factory function to create the appropriate TTS service based on configuration
 */
export const ttsServiceFactory = (
  configService: ConfigService,
  elevenLabsTtsService: ElevenLabsTtsService,
) => {
  // Default to ElevenLabs TTS service
  // In the future, this could be expanded to support other providers based on config
  return new TtsService(elevenLabsTtsService);
};
