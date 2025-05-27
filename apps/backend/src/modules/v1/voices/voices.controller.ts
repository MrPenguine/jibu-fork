import { Controller, Get, Logger, Param, NotFoundException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiParam } from '@nestjs/swagger';
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

  @Get(':voiceId/preview-url')
  @ApiOperation({ summary: 'Get a fresh preview URL for a specific voice' })
  @ApiParam({ name: 'voiceId', description: 'The ID of the voice to get a preview URL for' })
  @ApiResponse({
    status: 200,
    description: 'Fresh preview URL for the specified voice',
    schema: {
      type: 'object',
      properties: {
        previewUrl: { type: 'string', description: 'The URL to preview the voice' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Voice not found' })
  async getVoicePreviewUrl(@Param('voiceId') voiceId: string): Promise<{ previewUrl: string }> {
    this.logger.log(`Fetching fresh preview URL for voice ID: ${voiceId}`);
    const previewUrl = await this.voicesService.getVoicePreviewUrl(voiceId);
    
    if (!previewUrl) {
      throw new NotFoundException(`Voice with ID ${voiceId} not found or preview URL not available`);
    }
    
    return { previewUrl };
  }
}
