import { Controller, Get, Post, Body, Logger, Param, NotFoundException, StreamableFile, Header, Res, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiParam, ApiBody } from '@nestjs/swagger';
import { VoicesService } from './voices.service';
import { VoiceDTO } from '../../../integrations/tts/dto/voice.dto';
import { TtsVoiceSettings } from '../../../integrations/tts/interfaces/tts.interface';
import { TextToSpeechDto } from './dto/text-to-speech.dto';
import { Response } from 'express';

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

  @Post('text-to-speech')
  @ApiOperation({ summary: 'Convert text to speech using specified voice settings' })
  @ApiBody({ type: TextToSpeechDto })
  @ApiResponse({
    status: 200,
    description: 'Audio file in MP3 format',
    content: {
      'audio/mpeg': {},
    },
  })
  @ApiResponse({ status: 404, description: 'Voice not found' })
  @Header('Content-Type', 'audio/mpeg')
  @Header('Content-Disposition', 'attachment; filename="speech.mp3"')
  async textToSpeech(
    @Body() dto: TextToSpeechDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    this.logger.log(`Converting text to speech with voice ID: ${dto.voiceId}`);
    
    // Map the DTO to the voice settings required by the service
    const voiceSettings: TtsVoiceSettings = {
      voiceId: dto.voiceId,
      modelId: dto.modelId,
      stability: dto.stability,
      similarityBoost: dto.similarityBoost,
      style: dto.style,
      speakerBoost: dto.speakerBoost,
    };
    
    // Convert text to speech
    const audioBuffer = await this.voicesService.textToSpeech(dto.text, voiceSettings);
    
    // Return the audio as a streamable file
    return new StreamableFile(audioBuffer);
  }
  
  @Post('text-to-speech/stream')
  @ApiOperation({ summary: 'Stream text to speech using specified voice settings' })
  @ApiBody({ type: TextToSpeechDto })
  @ApiResponse({
    status: 200,
    description: 'Audio stream in MP3 format',
    content: {
      'audio/mpeg': {},
    },
  })
  @ApiResponse({ status: 404, description: 'Voice not found' })
  @Header('Content-Type', 'audio/mpeg')
  @Header('Transfer-Encoding', 'chunked')
  @Header('Cache-Control', 'no-cache')
  @Header('Connection', 'keep-alive')
  async streamTextToSpeech(
    @Body() dto: TextToSpeechDto,
    @Res() res: Response,
  ): Promise<void> {
    this.logger.log(`Streaming text to speech with voice ID: ${dto.voiceId}`);
    
    try {
      // Map the DTO to the voice settings required by the service
      const voiceSettings: TtsVoiceSettings = {
        voiceId: dto.voiceId,
        modelId: dto.modelId,
        stability: dto.stability,
        similarityBoost: dto.similarityBoost,
        style: dto.style,
        speakerBoost: dto.speakerBoost,
      };
      
      // Get the stream from the service
      const audioStream = await this.voicesService.streamTextToSpeech(dto.text, voiceSettings);
      
      // Set response headers
      res.status(HttpStatus.OK);
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Transfer-Encoding', 'chunked');
      
      // Pipe the audio stream to the response
      audioStream.pipe(res);
      
      // Handle errors
      audioStream.on('error', (error) => {
        this.logger.error(`Error streaming audio: ${error.message}`, error.stack);
        if (!res.headersSent) {
          res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            message: 'Error streaming audio',
            error: error.message,
          });
        } else {
          res.end();
        }
      });
    } catch (error) {
      this.logger.error(`Error in streamTextToSpeech: ${error.message}`, error.stack);
      if (!res.headersSent) {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          message: 'Error streaming text to speech',
          error: error.message,
        });
      } else {
        res.end();
      }
    }
  }
}
