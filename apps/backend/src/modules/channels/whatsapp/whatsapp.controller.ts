import { Controller, Get, Post, Query, Body, Res, HttpCode, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '../../../core/auth/decorators/public.decorator';
import { WhatsAppService, WhatsAppWebhookBody } from './whatsapp.service';

@ApiTags('channels')
@Controller('channels/whatsapp')
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);

  constructor(private readonly whatsappService: WhatsAppService) {}

  @Get('webhook')
  @Public()
  @ApiOperation({ summary: 'WhatsApp webhook verification (Meta hub challenge)' })
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ): void {
    try {
      const result = this.whatsappService.verifyWebhook(mode, token, challenge);
      res.status(200).send(result);
    } catch {
      res.status(403).send('Forbidden');
    }
  }

  @Post('webhook')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'WhatsApp inbound message webhook' })
  async inbound(@Body() body: WhatsAppWebhookBody): Promise<{ received: boolean }> {
    // Acknowledge immediately; process asynchronously so Meta doesn't retry.
    this.whatsappService.handleInbound(body).catch((e) => {
      this.logger.error(`WhatsApp inbound handling failed: ${e.message}`);
    });
    return { received: true };
  }
}
