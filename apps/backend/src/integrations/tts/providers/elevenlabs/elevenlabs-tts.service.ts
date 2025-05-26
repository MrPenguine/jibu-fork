import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ITtsService } from '../../interfaces/tts.interface';
import { ListVoicesResponseDTO, VoiceDTO } from '../../dto/voice.dto';

/**
 * ElevenLabs TTS service implementation
 */
@Injectable()
export class ElevenLabsTtsService implements ITtsService {
  private readonly logger = new Logger(ElevenLabsTtsService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.elevenlabs.io/v2';

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('ELEVENLABS_API_KEY');
    if (!this.apiKey) {
      this.logger.warn('ELEVENLABS_API_KEY not set. ElevenLabs TTS service will not function properly.');
    }
  }

  /**
   * Get all available voices from ElevenLabs
   * @returns Promise with an array of voices
   */
  async getVoices(): Promise<VoiceDTO[]> {
    try {
      const response = await this.fetchAllVoices();
      return response;
    } catch (error) {
      this.logger.error(`Failed to fetch voices from ElevenLabs: ${error.message}`, error.stack);
      throw new Error(`Failed to fetch voices from ElevenLabs: ${error.message}`);
    }
  }

  /**
   * Fetch all voices from ElevenLabs API, handling pagination
   * @returns Promise with an array of all voices
   */
  private async fetchAllVoices(): Promise<VoiceDTO[]> {
    let allVoices: VoiceDTO[] = [];
    let nextPageToken: string = null;
    let hasMore = true;

    while (hasMore) {
      const params: Record<string, any> = {
        page_size: 100, // Maximum allowed by the API
        include_total_count: true,
      };

      if (nextPageToken) {
        params.next_page_token = nextPageToken;
      }

      const response = await axios.get<ListVoicesResponseDTO>(`${this.baseUrl}/voices`, {
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        params,
      });

      const data = response.data;
      
      // Map the API response to our VoiceDTO objects and add provider information
      const mappedVoices = data.voices.map(voice => {
        // Add provider information
        const voiceDto = new VoiceDTO();
        Object.assign(voiceDto, voice);
        
        // Set provider to ElevenLabs
        voiceDto.provider = 'ElevenLabs';
        
        // Set price per minute (this could be dynamic based on voice tier)
        voiceDto.pricePerMinute = '$0.015';
        
        return voiceDto;
      });
      
      allVoices = [...allVoices, ...mappedVoices];
      
      hasMore = data.hasMore;
      nextPageToken = data.nextPageToken;
    }

    return allVoices;
  }
}
