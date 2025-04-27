import { Controller, Post, Body, Headers, Logger, UnauthorizedException, HttpCode, Get, Param, Req } from '@nestjs/common';
import { Request } from 'express';
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
    @Req() req: Request,
    @Body() payload: any,
    @Headers('webhook-signature') signature: string,
    @Headers('webhook-timestamp') timestamp: string,
    @Headers() headers: any,
  ) {
    try {
      this.logger.log('Received headers:', JSON.stringify(headers));
      this.logger.log('Received payload:', JSON.stringify(payload));
      
      const rawBody = (req as any).rawBody;
      if (!rawBody) {
        this.logger.error('Raw body is not available. Ensure rawBody: true is set in NestFactory.create.');
        throw new UnauthorizedException('Internal server error: Raw body missing');
      }
      
      // If we have a signature header, verify it
      if (signature && timestamp) {
        // Optional: Bypass verification in development
        if (process.env.DISABLE_WEBHOOK_VERIFICATION === 'true') {
          this.logger.warn('Webhook verification disabled for development');
        } else {
          try {
            this.verifySignature(rawBody, signature, timestamp);
          } catch (error) {
            this.logger.error(`Signature verification failed: ${error.message}`);
            throw new UnauthorizedException('Invalid webhook signature');
          }
        }
      } else {
        // For development/testing purposes, allow requests without signatures
        this.logger.warn('Request missing signature or timestamp headers');
        if (process.env.NODE_ENV === 'production' && process.env.DISABLE_WEBHOOK_VERIFICATION !== 'true') {
          throw new UnauthorizedException('Signature verification required in production');
        }
      }

      // Handle based on payload format
      if (payload.type && payload.table) {
        // Row-level changes webhook (e.g., from database webhooks)
        return this.handleTableChanges(payload);
      } else if (payload.type === 'auth' && payload.event) {
        // Auth webhook (e.g., user.created, user.updated)
        return this.handleAuthEvent(payload);
      } else if (payload.user_id && payload.claims) {
        // Potentially another auth webhook format (custom?)
        // Adjust this condition based on actual observed payloads if needed
        this.logger.log('Processing potential custom auth event format');
        return this.handleAuthEvent(payload); // Assuming it can be handled similarly
      } else {
        this.logger.warn('Unknown webhook format', JSON.stringify(payload));
        return { success: false, message: 'Unknown webhook format' };
      }
    } catch (error) {
      this.logger.error(`Error processing webhook: ${error.message}`, error.stack);
      // Return 200 anyway to prevent Supabase from retrying too aggressively
      return { success: false, error: error.message };
    }
  }

  /**
   * Verify the webhook signature to ensure it's from Supabase
   */
  private verifySignature(rawBody: Buffer, signature: string, timestamp: string): void {
    const webhookSecret = this.configService.get<string>('SUPABASE_WEBHOOK_SECRET');
    
    if (!webhookSecret) {
      this.logger.warn('SUPABASE_WEBHOOK_SECRET not set, skipping signature verification');
      return; // Or throw if secret is mandatory in production
    }

    if (!signature) {
      this.logger.error('Missing signature header');
      throw new UnauthorizedException('Missing signature header');
    }

    if (!timestamp) {
      this.logger.error('Missing timestamp header');
      throw new UnauthorizedException('Missing timestamp header');
    }

    try {
      // Extract the signature part after 'v1,'
      const signatureParts = signature.split(',');
      if (signatureParts.length !== 2 || signatureParts[0] !== 'v1') {
        this.logger.error('Invalid signature format');
        throw new UnauthorizedException('Invalid signature format');
      }
      
      const receivedSignatureBase64 = signatureParts[1];
      
      // Supabase uses timestamp.body format for signature calculation
      const hmac = crypto.createHmac('sha256', webhookSecret);
      // Ensure rawBody is treated as UTF8 string as per Supabase docs/common practice
      hmac.update(`${timestamp}.${rawBody.toString('utf8')}`); 
      const computedSignatureBase64 = hmac.digest('base64');
      
      this.logger.debug(`Expected signature: ${computedSignatureBase64}`);
      this.logger.debug(`Received signature: ${receivedSignatureBase64}`);
      
      // Securely compare signatures
      const expectedBuffer = Buffer.from(computedSignatureBase64, 'base64');
      const receivedBuffer = Buffer.from(receivedSignatureBase64, 'base64');

      if (expectedBuffer.length !== receivedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)) {
        this.logger.error('Signature verification failed (timing safe comparison)');
        throw new UnauthorizedException('Invalid webhook signature');
      }

      this.logger.log('Signature verification successful');

    } catch (error) {
      // Catch specific errors if needed, otherwise rethrow
      this.logger.error(`Signature verification error: ${error.message}`);
      // Ensure the original error type is preserved if it's already UnauthorizedException
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      // Wrap other errors
      throw new UnauthorizedException(`Signature verification failed: ${error.message}`);
    }
  }

  // Handler for row-level changes (e.g., database webhooks)
  private async handleTableChanges(payload: any) {
    const { type, table, record, old_record } = payload;
    this.logger.log(`Processing table change: ${type} on ${table}`);
    
    // Example: Sync user data when the 'users' table changes
    if (table === 'users' && record) {
      // Determine if it's an insert, update, or delete based on type
      if (type === 'INSERT' || type === 'UPDATE') {
        await this.userSyncService.syncUserFromSupabase(record);
      } else if (type === 'DELETE' && old_record) {
        await this.userSyncService.handleUserDeletion(old_record.id);
      } else {
        this.logger.warn(`Unhandled table change type: ${type}`);
      }
    } else {
      this.logger.log(`Ignoring change on table: ${table}`);
    }
    
    return { success: true };
  }

  // Handler for Supabase Auth events
  private async handleAuthEvent(payload: any) {
    // Handle the structure observed in logs or documented by Supabase Auth webhooks
    // This might be { type: 'auth', event: 'user.created', record: {...} }
    // Or it might be { user_id: '...', claims: {...} } as suggested in advice
    
    if (payload.type === 'auth' && payload.event && payload.record) {
      // Standard Supabase Auth webhook format
      const { event, record } = payload;
      this.logger.log(`Processing auth event: ${event} for user: ${record.id}`);
      switch (event) {
        case 'user.created':
        case 'user.updated':
          await this.userSyncService.syncUserFromSupabase(record);
          break;
        case 'user.deleted':
          await this.userSyncService.handleUserDeletion(record.id);
          break;
        default:
          this.logger.warn(`Unhandled auth event: ${event}`);
      }
    } else if (payload.user_id && payload.claims) {
      // Handle the alternative format if needed
      const { user_id, claims } = payload;
      this.logger.log(`Processing auth event (claims format) for user: ${user_id}`);
      if (claims && claims.email) {
        const userData = {
          id: user_id,
          email: claims.email,
          // Map other relevant claims to your user model
          raw_user_meta_data: claims.user_metadata || {}, // Adjust based on your UserSyncService needs
          // Add other fields as necessary, e.g., phone, created_at, updated_at if available in claims
        };
        await this.userSyncService.syncUserFromSupabase(userData);
      } else {
        this.logger.warn(`Auth event (claims format) missing email for user: ${user_id}`);
      }
    } else {
      this.logger.warn('Could not determine auth event structure', JSON.stringify(payload));
      return { success: false, message: 'Unknown auth event structure' };
    }
    
    return { success: true };
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