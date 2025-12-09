import { Body, Controller, HttpCode, Logger, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Public } from '../../core/auth/decorators/public.decorator';
import { VoiceService } from './voice.service';

@ApiTags('voice-webhook')
@Controller('voice')
export class TwilioController {
  private readonly logger = new Logger(TwilioController.name);

  constructor(private readonly voiceService: VoiceService) {}

  @Public()
  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Twilio voice webhook — forwards call events into WEBHOOK_DELIVERY queue' })
  async handleTwilioWebhook(@Body() body: any, @Req() req: Request, @Res() res: Response): Promise<void> {
    const callSid = body?.CallSid || 'unknown';
    this.logger.log(`[VOICE][Twilio] Incoming voice webhook for CallSid=${callSid}`);

    const workflowId = (req.query.workflowId as string) || body.workflowId || body.WorkflowId;
    const sessionId =
      (req.query.sessionId as string) || body.sessionId || body.SessionId || body.CallSid;

    try {
      await this.voiceService.handleTwilioWebhook({
        ...body,
        workflowId,
        sessionId,
      });
    } catch (error) {
      const err = error as Error;
      this.logger.warn(
        `[VOICE][Twilio] Error handling webhook for CallSid=${callSid}: ${err.message}`,
      );
    }

    // Always respond immediately with empty TwiML — do not wait for queue
    res.type('text/xml').send('<Response></Response>');
  }
}
