import { Controller, Get, Logger } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { VoicesService } from './voices.service';
import { VoiceDTO } from '../../../integrations/tts/dto/voice.dto';

@ApiTags('voices')
@Controller('v1/voices')
export class VoicesController {
  private readonly logger = new Logger(VoicesController.name);

  constructor(private readonly voicesService: VoicesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all available TTS voices' })
  @ApiResponse({
    status: 200,
    description: 'List of all available TTS voices',
    type: [VoiceDTO],
  })
  async getVoices(): Promise<VoiceDTO[]> {
    this.logger.log('Fetching all available TTS voices');
    return this.voicesService.getVoices();
  }
}
