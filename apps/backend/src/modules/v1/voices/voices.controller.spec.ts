import { Test, TestingModule } from '@nestjs/testing';
import { VoicesController } from './voices.controller';
import { VoicesService } from './voices.service';
import { ITtsService } from '../../../integrations/tts/interfaces/tts.interface';
import { VoiceDTO } from '../../../integrations/tts/dto/voice.dto';

describe('VoicesController', () => {
  let controller: VoicesController;
  let voicesService: VoicesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VoicesController],
      providers: [
        VoicesService,
        {
          provide: ITtsService,
          useValue: {
            getVoices: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<VoicesController>(VoicesController);
    voicesService = module.get<VoicesService>(VoicesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getVoices', () => {
    it('should return an array of voices', async () => {
      // Mock data
      const mockVoices: VoiceDTO[] = [
        {
          voiceId: '21m00Tcm4TlvDq8ikWAM',
          name: 'Rachel',
          category: 'professional',
          labels: {
            accent: 'American',
            gender: 'female',
          },
          description: 'A warm voice with a conversational tone',
          previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/21m00Tcm4TlvDq8ikWAM/df6285d9-9a93-4c7d-b0bf-14628f2e3e6c.mp3',
        },
      ];

      // Mock the service method
      jest.spyOn(voicesService, 'getVoices').mockResolvedValue(mockVoices);

      // Call the controller method
      const result = await controller.getVoices();

      // Verify the results
      expect(result).toBe(mockVoices);
      expect(voicesService.getVoices).toHaveBeenCalled();
    });
  });
});
