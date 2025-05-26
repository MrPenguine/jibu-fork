import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ElevenLabsTtsService } from './elevenlabs-tts.service';
import { VoiceDTO } from '../../dto/voice.dto';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ElevenLabsTtsService', () => {
  let service: ElevenLabsTtsService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
        }),
      ],
      providers: [
        ElevenLabsTtsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'ELEVENLABS_API_KEY') {
                return 'test-api-key';
              }
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<ElevenLabsTtsService>(ElevenLabsTtsService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getVoices', () => {
    it('should fetch voices from ElevenLabs API', async () => {
      // Mock the API response
      const mockVoicesResponse = {
        data: {
          voices: [
            {
              voice_id: '21m00Tcm4TlvDq8ikWAM',
              name: 'Rachel',
              samples: [
                {
                  sample_id: 'sample1',
                  file_name: 'sample.mp3',
                },
              ],
              category: 'professional',
              fine_tuning: {
                is_allowed_to_fine_tune: true,
              },
              labels: {
                accent: 'American',
                gender: 'female',
              },
              description: 'A warm voice with a conversational tone',
              preview_url: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/21m00Tcm4TlvDq8ikWAM/df6285d9-9a93-4c7d-b0bf-14628f2e3e6c.mp3',
            },
          ],
          has_more: false,
          total_count: 1,
        },
      };

      // Set up the mock to return our mock response
      mockedAxios.get.mockResolvedValueOnce(mockVoicesResponse);

      // Call the service method
      const result = await service.getVoices();

      // Verify the results
      expect(result).toHaveLength(1);
      expect(result[0].voiceId).toBe('21m00Tcm4TlvDq8ikWAM');
      expect(result[0].name).toBe('Rachel');
      expect(result[0].previewUrl).toBe('https://storage.googleapis.com/eleven-public-prod/premade/voices/21m00Tcm4TlvDq8ikWAM/df6285d9-9a93-4c7d-b0bf-14628f2e3e6c.mp3');

      // Verify that axios.get was called with the correct parameters
      expect(mockedAxios.get).toHaveBeenCalledWith('https://api.elevenlabs.io/v2/voices', {
        headers: {
          'xi-api-key': 'test-api-key',
          'Content-Type': 'application/json',
        },
        params: {
          page_size: 100,
          include_total_count: true,
        },
      });
    });

    it('should handle pagination when fetching voices', async () => {
      // Mock the first API response with pagination
      const mockFirstResponse = {
        data: {
          voices: [
            {
              voice_id: 'voice1',
              name: 'Voice 1',
            },
          ],
          has_more: true,
          next_page_token: 'next-page-token',
        },
      };

      // Mock the second API response
      const mockSecondResponse = {
        data: {
          voices: [
            {
              voice_id: 'voice2',
              name: 'Voice 2',
            },
          ],
          has_more: false,
        },
      };

      // Set up the mock to return our mock responses in sequence
      mockedAxios.get
        .mockResolvedValueOnce(mockFirstResponse)
        .mockResolvedValueOnce(mockSecondResponse);

      // Call the service method
      const result = await service.getVoices();

      // Verify the results
      expect(result).toHaveLength(2);
      expect(result[0].voiceId).toBe('voice1');
      expect(result[1].voiceId).toBe('voice2');

      // Verify that axios.get was called with the correct parameters for both requests
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
      expect(mockedAxios.get).toHaveBeenNthCalledWith(1, 'https://api.elevenlabs.io/v2/voices', {
        headers: {
          'xi-api-key': 'test-api-key',
          'Content-Type': 'application/json',
        },
        params: {
          page_size: 100,
          include_total_count: true,
        },
      });
      expect(mockedAxios.get).toHaveBeenNthCalledWith(2, 'https://api.elevenlabs.io/v2/voices', {
        headers: {
          'xi-api-key': 'test-api-key',
          'Content-Type': 'application/json',
        },
        params: {
          page_size: 100,
          include_total_count: true,
          next_page_token: 'next-page-token',
        },
      });
    });

    it('should handle API errors gracefully', async () => {
      // Mock the API to throw an error
      mockedAxios.get.mockRejectedValueOnce(new Error('API Error'));

      // Call the service method and expect it to throw
      await expect(service.getVoices()).rejects.toThrow('Failed to fetch voices from ElevenLabs: API Error');
    });
  });
});
