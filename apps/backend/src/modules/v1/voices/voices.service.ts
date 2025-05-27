import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { TtsService } from '../../../integrations/tts/tts.service';
import { VoiceDTO } from '../../../integrations/tts/dto/voice.dto';
import { TtsVoiceSettings } from '../../../integrations/tts/interfaces/tts.interface';
import { RedisService } from '../../../core/redis/redis.service';
import { Interval } from '@nestjs/schedule';
import { Readable } from 'stream';

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
   * @param voiceId The ID of the voice to get a preview URL for
   * @returns Promise with the preview URL or null if not available
   */
  async getVoicePreviewUrl(voiceId: string): Promise<string | null> {
    try {
      this.logger.log(`Fetching fresh preview URL for voice ID: ${voiceId}`);
      
      // Check if we have this voice in our cache
      const cachedVoices = await this.redisService.get(this.CACHE_KEY);
      let foundVoice: VoiceDTO | null = null;
      
      if (cachedVoices) {
        const voices = JSON.parse(cachedVoices) as VoiceDTO[];
        foundVoice = voices.find(v => v.voiceId === voiceId) || null;
      }
      
      // If the voice doesn't exist in our cache, return null
      if (!foundVoice) {
        this.logger.warn(`Voice ID ${voiceId} not found in cache`);
        return null;
      }
      
      // If the voice already has a preview URL, return it
      if (foundVoice.previewUrl) {
        return foundVoice.previewUrl;
      }
      
      // Otherwise, fetch a fresh preview URL from the TTS service
      // This is particularly useful for AI-generated voices that may not have a preview URL
      // or whose preview URL has expired
      this.logger.log(`Fetching fresh preview URL for voice ID: ${voiceId}`);
      
      // Use the existing fetchFreshPreviewUrl method which should make the appropriate API call
      return this.fetchFreshPreviewUrl(voiceId);
    } catch (error) {
      this.logger.error(`Error getting preview URL for voice ID ${voiceId}: ${error.message}`, error.stack);
      return null;
    }
  }
  
  /**
   * Convert text to speech using the specified voice and settings
   * @param text The text to convert to speech
   * @param voiceSettings Voice settings including voice ID and parameters
   * @returns Promise with audio buffer
   */
  async textToSpeech(text: string, voiceSettings: TtsVoiceSettings): Promise<Buffer> {
    try {
      this.logger.log(`Converting text to speech with voice ID: ${voiceSettings.voiceId}`);
      return this.ttsService.textToSpeech(text, voiceSettings);
    } catch (error) {
      this.logger.error(`Error converting text to speech: ${error.message}`, error.stack);
      throw error;
    }
  }
  
  /**
   * Stream text to speech using the specified voice and settings
   * @param text The text to convert to speech
   * @param voiceSettings Voice settings including voice ID and parameters
   * @returns Promise with a readable stream
   */
  async streamTextToSpeech(text: string, voiceSettings: TtsVoiceSettings): Promise<Readable> {
    try {
      this.logger.log(`Streaming text to speech with voice ID: ${voiceSettings.voiceId}`);
      return this.ttsService.streamTextToSpeech(text, voiceSettings);
    } catch (error) {
      this.logger.error(`Error streaming text to speech: ${error.message}`, error.stack);
      throw error;
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
