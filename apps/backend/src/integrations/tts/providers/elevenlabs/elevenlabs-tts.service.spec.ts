import { Test, TestingModule } from '@nestjs/testing';
import axios from 'axios';
import { ElevenLabsTtsService } from './elevenlabs-tts.service';
import { ProviderCredentialsResolver } from '../../../../core/provider-credentials/provider-credentials.resolver';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ElevenLabsTtsService', () => {
  let service: ElevenLabsTtsService;
  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ElevenLabsTtsService,
        {
          provide: ProviderCredentialsResolver,
          useValue: {
            getSecret: jest.fn().mockResolvedValue('test-api-key'),
          },
        },
      ],
    }).compile();

    service = module.get<ElevenLabsTtsService>(ElevenLabsTtsService);
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
              voiceId: '21m00Tcm4TlvDq8ikWAM',
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
              previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/21m00Tcm4TlvDq8ikWAM/df6285d9-9a93-4c7d-b0bf-14628f2e3e6c.mp3',
            },
          ],
          hasMore: false,
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
              voiceId: 'voice1',
              name: 'Voice 1',
            },
          ],
          hasMore: true,
          nextPageToken: 'next-page-token',
        },
      };

      // Mock the second API response
      const mockSecondResponse = {
        data: {
          voices: [
            {
              voiceId: 'voice2',
              name: 'Voice 2',
            },
          ],
          hasMore: false,
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
