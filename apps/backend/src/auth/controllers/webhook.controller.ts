import { Controller, Post, Body, Logger, UnauthorizedException, HttpCode, Get, Param, Req, UseGuards } from '@nestjs/common'; // Added UseGuards
import { Request } from 'express';
import { UserSyncService } from '../services/sync.service';
import { ConfigService } from '@nestjs/config';
import { Public } from '../decorators/public.decorator';
import { SupabaseWebhookGuard } from '../guards/supabase-webhook.guard'; // Import the guard
// Removed crypto import as it's now handled by the guard

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
  @UseGuards(SupabaseWebhookGuard) // Apply the webhook guard for signature verification
  @Post()
  @HttpCode(200)
  async handleWebhook(
    @Req() req: Request, // Guard now handles headers and rawBody access
    @Body() payload: any,
    // Removed signature, timestamp, and headers parameters as they are handled by the guard
  ) {
    try {
      this.logger.log('Received payload:', JSON.stringify(payload));
      // Signature verification is now handled by the SupabaseWebhookGuard

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

  // Removed the verifySignature method as it's now handled by SupabaseWebhookGuard

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