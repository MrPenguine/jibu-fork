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
