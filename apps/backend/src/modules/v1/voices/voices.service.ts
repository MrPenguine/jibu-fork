import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { TtsService } from '../../../integrations/tts/tts.service';
import { VoiceDTO } from '../../../integrations/tts/dto/voice.dto';
import { RedisService } from '../../../core/redis/redis.service';
import { Interval } from '@nestjs/schedule';

@Injectable()
export class VoicesService implements OnModuleInit {
  private readonly logger = new Logger(VoicesService.name);
  private readonly CACHE_KEY = 'elevenlabs:voices';
  private readonly CACHE_TTL = 3600; // Cache for 1 hour (in seconds)
  private readonly REFRESH_INTERVAL = 300; // Refresh every 5 minutes (in seconds)
  private isInitialDataLoaded = false;

  constructor(
    private readonly ttsService: TtsService,
    private readonly redisService: RedisService
  ) {}
  
  /**
   * Initialize the service and ensure voice data is loaded into Redis
   */
  async onModuleInit() {
    this.logger.log('Initializing VoicesService...');
    await this.loadInitialVoiceData();
  }
  
  /**
   * Load initial voice data into Redis
   */
  private async loadInitialVoiceData(): Promise<void> {
    try {
      // Check if data already exists in Redis
      const cachedVoices = await this.redisService.get(this.CACHE_KEY);
      
      if (!cachedVoices) {
        this.logger.log('No voice data in Redis, fetching from TTS service...');
        // Fetch and cache the data
        const voices = await this.ttsService.getVoices();
        
        if (voices && voices.length > 0) {
          this.logger.log(`Caching ${voices.length} voices for ${this.CACHE_TTL} seconds`);
          await this.redisService.set(this.CACHE_KEY, JSON.stringify(voices), this.CACHE_TTL);
          this.isInitialDataLoaded = true;
        } else {
          this.logger.warn('No voices returned from TTS service during initialization');
        }
      } else {
        this.logger.log('Voice data already exists in Redis');
        this.isInitialDataLoaded = true;
      }
    } catch (error) {
      this.logger.error(`Failed to load initial voice data: ${error.message}`);
    }
  }
  
  /**
   * Refresh voice data in Redis at regular intervals
   * This runs every REFRESH_INTERVAL seconds (default: 5 minutes)
   */
  @Interval(300000) // 5 minutes in milliseconds
  async refreshVoiceData() {
    try {
      this.logger.log('Background refresh: Fetching fresh voice data from TTS service...');
      const voices = await this.ttsService.getVoices();
      
      if (voices && voices.length > 0) {
        this.logger.log(`Background refresh: Updating cache with ${voices.length} voices`);
        // Update the cache with fresh data
        await this.redisService.set(this.CACHE_KEY, JSON.stringify(voices), this.CACHE_TTL);
      } else {
        this.logger.warn('Background refresh: No voices returned from TTS service');
      }
    } catch (error) {
      this.logger.error(`Background refresh failed: ${error.message}`);
    }
  }

  /**
   * Get all available voices from the TTS provider
   * @returns Promise with an array of voices
   */
  async getVoices(): Promise<VoiceDTO[]> {
    try {
      // Always try to get from cache first for fast loading
      const cachedVoices = await this.redisService.get(this.CACHE_KEY);
      
      if (cachedVoices) {
        this.logger.log('Returning voices from cache');
        
        // Trigger a background refresh if we're returning cached data
        // but don't wait for it to complete
        if (this.isInitialDataLoaded) {
          this.triggerBackgroundRefresh().catch(err => {
            this.logger.error(`Background refresh error: ${err.message}`);
          });
        }
        
        return JSON.parse(cachedVoices);
      }
      
      // If not in cache (which should be rare due to our background refresh),
      // fetch directly and cache the results
      this.logger.log('Cache miss! Fetching voices from TTS service');
      const voices = await this.ttsService.getVoices();
      
      if (voices && voices.length > 0) {
        this.logger.log(`Caching ${voices.length} voices for ${this.CACHE_TTL} seconds`);
        await this.redisService.set(this.CACHE_KEY, JSON.stringify(voices), this.CACHE_TTL);
        this.isInitialDataLoaded = true;
      } else {
        this.logger.warn('No voices returned from TTS service');
      }
      
      return voices;
    } catch (error) {
      this.logger.error(`Error fetching voices: ${error.message}`);
      
      // If there was an error but we have cached data, return that as a fallback
      const cachedVoices = await this.redisService.get(this.CACHE_KEY);
      if (cachedVoices) {
        this.logger.log('Returning cached voices after error');
        return JSON.parse(cachedVoices);
      }
      
      // If all else fails, throw the error
      throw error;
    }
  }
  
  /**
   * Get a fresh preview URL for a specific voice
   * This is particularly useful for AI-generated voices that may not have a preview URL
   * or whose preview URL has expired
   * 
   * @param voiceId The ID of the voice to get a preview URL for
   * @returns A fresh preview URL or null if the voice is not found
   */
  async getVoicePreviewUrl(voiceId: string): Promise<string | null> {
    try {
      this.logger.log(`Fetching fresh preview URL for voice ID: ${voiceId}`);
      
      // Check if we have this voice in our cache
      const cachedVoices = await this.redisService.get(this.CACHE_KEY);
      let voiceExists = false;
      
      if (cachedVoices) {
        const voices = JSON.parse(cachedVoices) as VoiceDTO[];
        voiceExists = voices.some(voice => voice.voiceId === voiceId);
      }
      
      // If the voice doesn't exist in our cache, we need to check directly with the TTS service
      if (!voiceExists) {
        this.logger.log(`Voice ID ${voiceId} not found in cache, checking with TTS service`);
        const voices = await this.ttsService.getVoices();
        voiceExists = voices.some(voice => voice.voiceId === voiceId);
        
        if (!voiceExists) {
          this.logger.warn(`Voice ID ${voiceId} not found in TTS service`);
          return null;
        }
      }
      
      // At this point, we know the voice exists, so we can fetch a fresh preview URL
      // This would typically be an API call to the TTS service to get a fresh signed URL
      // For ElevenLabs, we need to make a specific API call to get a sample for this voice
      const previewUrl = await this.fetchFreshPreviewUrl(voiceId);
      
      if (!previewUrl) {
        this.logger.warn(`Failed to fetch preview URL for voice ID ${voiceId}`);
        return null;
      }
      
      return previewUrl;
    } catch (error) {
      this.logger.error(`Error fetching preview URL for voice ID ${voiceId}: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Fetch a fresh preview URL for a specific voice from the TTS service
   * This makes a direct API call to get a new sample URL for the voice
   * 
   * @param voiceId The ID of the voice to get a preview URL for
   * @returns A fresh preview URL or null if unable to fetch
   */
  private async fetchFreshPreviewUrl(voiceId: string): Promise<string | null> {
    try {
      // For ElevenLabs, we need to make a specific API call to get a sample
      // This would typically be implemented in the TTS service
      // For now, we'll delegate to the TTS service to get a fresh sample
      
      // Check if the TTS service has a method to get a voice sample
      if (typeof this.ttsService['getVoiceSample'] === 'function') {
        this.logger.log(`Requesting fresh voice sample for voice ID: ${voiceId}`);
        const sampleUrl = await this.ttsService['getVoiceSample'](voiceId);
        return sampleUrl;
      }
      
      // If the TTS service doesn't have a method to get a voice sample,
      // we'll need to fetch all voices and find the one we want
      this.logger.log(`TTS service doesn't have getVoiceSample method, fetching all voices`);
      const voices = await this.ttsService.getVoices();
      const voice = voices.find(v => v.voiceId === voiceId);
      
      if (voice && voice.previewUrl) {
        return voice.previewUrl;
      }
      
      // If we still don't have a preview URL, we'll need to generate one
      // This would typically involve generating a sample audio file and getting a URL for it
      // For now, we'll return null and handle this case in the frontend
      this.logger.warn(`No preview URL available for voice ID: ${voiceId}`);
      return null;
    } catch (error) {
      this.logger.error(`Error fetching fresh preview URL: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Trigger a background refresh of voice data without waiting for completion
   * This is used to keep the cache fresh while still returning quickly to the user
   */
  private async triggerBackgroundRefresh(): Promise<void> {
    // Don't await this - we want it to run in the background
    setTimeout(async () => {
      try {
        this.logger.log('On-demand background refresh started');
        const voices = await this.ttsService.getVoices();
        
        if (voices && voices.length > 0) {
          this.logger.log(`On-demand refresh: Updating cache with ${voices.length} voices`);
          await this.redisService.set(this.CACHE_KEY, JSON.stringify(voices), this.CACHE_TTL);
        }
      } catch (error) {
        this.logger.error(`On-demand refresh failed: ${error.message}`);
      }
    }, 100); // Small delay to ensure we return cached data first
  }
}
