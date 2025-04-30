import { Controller, Post, Body, Logger, HttpCode, Get, Param, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { Public } from '../core/auth/decorators/public.decorator';
import { SupabaseWebhookGuard } from '../core/auth/guards/supabase-webhook.guard';
import { WebhookService } from './webhook.service';

@Controller('auth/webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly webhookService: WebhookService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Process Supabase auth webhooks
   * This endpoint receives events from Supabase Auth such as user creation, updates, and deletions
   */
  @Public()
  @UseGuards(SupabaseWebhookGuard)
  @Post()
  @HttpCode(200)
  async handleWebhook(
    @Req() req: Request,
    @Body() payload: any,
  ) {
    return this.webhookService.processWebhook(payload);
  }

  /**
   * Test endpoint to manually trigger a user sync
   * For debugging purposes only - should be disabled in production
   */
  @Public()
  @Get('test-sync/:userId')
  async testSync(@Param('userId') userId: string) {
    return this.webhookService.testUserSync(userId);
  }
}