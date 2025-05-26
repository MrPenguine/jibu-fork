import { Injectable, Logger } from '@nestjs/common';
import { TtsService } from '../../../integrations/tts/tts.service';
import { VoiceDTO } from '../../../integrations/tts/dto/voice.dto';
import { RedisService } from '../../../core/redis/redis.service';

@Injectable()
export class VoicesService {
  private readonly logger = new Logger(VoicesService.name);

  constructor(
    private readonly ttsService: TtsService,
    private readonly redisService: RedisService
  ) {}

  /**
   * Get all available voices from the TTS provider
   * @returns Promise with an array of voices
   */
  async getVoices(): Promise<VoiceDTO[]> {
    const cacheKey = 'elevenlabs:voices';
    const cacheTtl = 3600; // Cache for 1 hour (in seconds)
    
    // Try to get from cache first
    const cachedVoices = await this.redisService.get(cacheKey);
    if (cachedVoices) {
      this.logger.log('Returning voices from cache');
      return JSON.parse(cachedVoices);
    }
    
    // If not in cache, fetch from TTS service
    this.logger.log('Fetching voices from TTS service');
    const voices = await this.ttsService.getVoices();
    
    // Cache the results
    if (voices && voices.length > 0) {
      this.logger.log(`Caching ${voices.length} voices for ${cacheTtl} seconds`);
      await this.redisService.set(cacheKey, JSON.stringify(voices), cacheTtl);
    }
    
    return voices;
  }
}
