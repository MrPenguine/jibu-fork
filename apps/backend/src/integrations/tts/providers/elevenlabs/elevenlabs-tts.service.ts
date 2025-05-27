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
   * Get a fresh sample/preview URL for a specific voice
   * This is particularly useful for AI-generated voices that may not have a preview URL
   * or whose preview URL has expired
   * 
   * @param voiceId The ID of the voice to get a sample for
   * @returns A fresh preview URL or null if unable to fetch
   */
  async getVoiceSample(voiceId: string): Promise<string | null> {
    try {
      this.logger.log(`Fetching sample for voice ID: ${voiceId}`);
      
      // For ElevenLabs, we need to generate a sample by synthesizing a short text
      // This will give us a fresh audio URL that we can use as a preview
      const sampleText = 'Hello, this is a sample of my voice.';
      
      // Make API call to generate the sample
      const response = await axios.post(
        `${this.baseUrl}/text-to-speech/${voiceId}/stream`,
        {
          text: sampleText,
          model_id: 'eleven_v2_flash', // Use the fastest model for previews
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.75,
          },
        },
        {
          headers: {
            'xi-api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
          responseType: 'arraybuffer', // Important for binary audio data
        }
      );
      
      // If we get a successful response, we need to save the audio data and create a URL
      if (response.status === 200 && response.data) {
        // For a real implementation, we would save this to a storage service like S3
        // and return a signed URL. For now, we'll use a data URL for simplicity.
        const audioBase64 = Buffer.from(response.data).toString('base64');
        const dataUrl = `data:audio/mpeg;base64,${audioBase64}`;
        
        this.logger.log(`Successfully generated sample for voice ID: ${voiceId}`);
        return dataUrl;
      }
      
      this.logger.warn(`Failed to generate sample for voice ID: ${voiceId}`);
      return null;
    } catch (error) {
      this.logger.error(`Error generating voice sample: ${error.message}`, error.stack);
      return null;
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
