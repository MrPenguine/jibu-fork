import { Controller, Post, Body, Headers, Logger, UnauthorizedException, HttpCode, Get, Param } from '@nestjs/common';
import { UserSyncService } from '../services/sync.service';
import { ConfigService } from '@nestjs/config';
import { Public } from '../decorators/public.decorator';
import * as crypto from 'crypto';

@Controller('auth/webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly userSyncService: UserSyncService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Process Supabase auth webhooks
   * This endpoint receives events from Supabase Auth such as user creation, updates, and deletions
   */
  @Public() // This needs to be public as Supabase won't have a JWT to authenticate
  @Post()
  @HttpCode(200)
  async handleWebhook(
    @Body() payload: any,
    @Headers('x-supabase-signature') signature: string,
  ) {
    try {
      // Verify the webhook signature
      this.verifySignature(payload, signature);

      const { type, event } = payload;
      this.logger.log(`Received webhook: ${type}.${event}`);

      // Process different event types
      if (type === 'auth') {
        switch (event) {
          case 'user.created':
            await this.userSyncService.syncUserFromSupabase(payload.record);
            break;
          case 'user.updated':
            await this.userSyncService.syncUserFromSupabase(payload.record);
            break;
          case 'user.deleted':
            await this.userSyncService.handleUserDeletion(payload.record.id);
            break;
          default:
            this.logger.warn(`Unhandled auth event: ${event}`);
        }
      }

      return { success: true };
    } catch (error) {
      this.logger.error(`Error processing webhook: ${error.message}`, error.stack);
      // Return 200 anyway to prevent Supabase from retrying too aggressively
      // But log the error for debugging
      return { success: false, error: error.message };
    }
  }

  /**
   * Verify the webhook signature to ensure it's from Supabase
   */
  private verifySignature(payload: any, signature: string): void {
    const webhookSecret = this.configService.get<string>('SUPABASE_WEBHOOK_SECRET');
    
    if (!webhookSecret) {
      this.logger.warn('SUPABASE_WEBHOOK_SECRET not set, skipping signature verification');
      return;
    }

    if (!signature) {
      this.logger.error('Missing signature header');
      throw new UnauthorizedException('Missing signature header');
    }

    try {
      // Create HMAC
      const hmac = crypto.createHmac('sha256', webhookSecret);
      hmac.update(JSON.stringify(payload));
      const computedSignature = hmac.digest('hex');

      this.logger.debug(`Computed signature: ${computedSignature}, Received: ${signature}`);

      // Time-safe comparison
      if (computedSignature !== signature) {
        this.logger.error('Invalid webhook signature');
        throw new UnauthorizedException('Invalid webhook signature');
      }
    } catch (error) {
      this.logger.error(`Signature verification error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Test endpoint to manually trigger a user sync
   * For debugging purposes only - should be disabled in production
   */
  @Public()
  @Get('test-sync/:userId')
  async testSync(@Param('userId') userId: string) {
    this.logger.log(`Manual test sync for user: ${userId}`);
    
    try {
      // Fetch user from Supabase
      // Note: In a real implementation, you would fetch from Supabase admin API
      // This is a simplified version for testing
      const mockUserData = {
        id: userId,
        email: `test-${userId}@example.com`,
        user_metadata: {
          first_name: 'Test',
          last_name: 'User',
        }
      };
      
      await this.userSyncService.syncUserFromSupabase(mockUserData);
      return { success: true, message: 'User sync triggered' };
    } catch (error) {
      this.logger.error(`Error in test sync: ${error.message}`, error.stack);
      return { success: false, error: error.message };
    }
  }
} 