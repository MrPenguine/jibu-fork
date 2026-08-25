import { Controller, Get, Post, Body, Req, Res, Logger, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { VoiceService } from '../../../core/services/voice.service';
import { Response } from 'express';
import { Public } from '../../../core/auth/decorators/public.decorator';

@ApiTags('tts')
@Controller('v1/tts')
export class TtsController {
  private readonly logger = new Logger(TtsController.name);

  @Public()
  @Get('audio/speech')
  @ApiOperation({ summary: 'OpenAI-compatible TTS GET endpoint' })
  async generateSpeechGet(
    @Query('input') input: string, 
    @Query('voice') voice: string, 
    @Query('workspaceId') queryWorkspaceId: string,
    @Req() req: any, 
    @Res() res: Response
  ) {
    try {
      this.logger.log(`Received TTS GET request for voice: ${voice}`);
      const workspaceId = req.headers?.['x-workspace-id'] as string || queryWorkspaceId || undefined;
      const stream: any = await VoiceService.generateStreamingSpeech(input, voice, workspaceId);
      res.setHeader('Content-Type', 'audio/wav');
      if (stream?.headers?.['content-length']) {
        res.setHeader('Content-Length', stream.headers['content-length']);
      }
      stream.on('error', (err) => {
        this.logger.error(`Stream error for TTS: ${err.message}`);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to stream audio' });
        } else {
          res.end();
        }
      });
      stream.pipe(res);
    } catch (error) {
      this.logger.error(`Error generating speech: ${error.message}`);
      res.status(500).json({ error: 'Failed to generate speech' });
    }
  }

  @Post('audio/speech')
  @ApiOperation({ summary: 'OpenAI-compatible TTS endpoint' })
  async generateSpeech(@Body() body: any, @Req() req: any, @Res() res: Response) {
    try {
      this.logger.log(`Received TTS request for voice: ${body.voice}`);
      
      const workspaceId = req.headers?.['x-workspace-id'] as string || undefined;
      
      const stream: any = await VoiceService.generateStreamingSpeech(
        body.input,
        body.voice,
        workspaceId
      );
      
      res.setHeader('Content-Type', 'audio/wav');
      if (stream?.headers?.['content-length']) {
        res.setHeader('Content-Length', stream.headers['content-length']);
      }
      stream.on('error', (err) => {
        this.logger.error(`Stream error for TTS: ${err.message}`);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to stream audio' });
        } else {
          res.end();
        }
      });
      stream.pipe(res);
    } catch (error) {
      this.logger.error(`Error generating speech: ${error.message}`);
      // Fallback to a default voice if the custom voice fails
      try {
        const stream: any = await VoiceService.generateStreamingSpeech(
          body.input,
          'alloy', // Default OpenAI voice
          'default'
        );
        res.setHeader('Content-Type', 'audio/wav');
        if (stream?.headers?.['content-length']) {
          res.setHeader('Content-Length', stream.headers['content-length']);
        }
        stream.on('error', (err) => {
          this.logger.error(`Stream error for TTS fallback: ${err.message}`);
          res.end();
        });
        stream.pipe(res);
      } catch (fallbackError) {
        res.status(500).json({ error: 'Failed to generate speech' });
      }
    }
  }
}
