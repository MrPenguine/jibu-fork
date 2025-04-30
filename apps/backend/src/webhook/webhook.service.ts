import { Injectable, Logger, Inject } from '@nestjs/common';
import { UserSyncService } from '../core/sync/sync.service';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @Inject(UserSyncService) private readonly userSyncService: UserSyncService,
  ) {}

  /**
   * Process webhook payload and route to appropriate handler
   */
  async processWebhook(payload: any) {
    try {
      this.logger.log('Processing payload:', JSON.stringify(payload));

      // Handle based on payload format
      if (payload.type && payload.table) {
        // Row-level changes webhook (e.g., from database webhooks)
        return this.handleTableChanges(payload);
      } else if (payload.type === 'auth' && payload.event) {
        // Auth webhook (e.g., user.created, user.updated)
        return this.handleAuthEvent(payload);
      } else if (payload.user_id && payload.claims) {
        // Potentially another auth webhook format (custom?)
        this.logger.log('Processing potential custom auth event format');
        return this.handleAuthEvent(payload); 
      } else {
        this.logger.warn('Unknown webhook format', JSON.stringify(payload));
        return { success: false, message: 'Unknown webhook format' };
      }
    } catch (error) {
      this.logger.error(`Error processing webhook: ${error.message}`, error.stack);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle row-level changes (e.g., database webhooks)
   */
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

  /**
   * Handle Supabase Auth events
   */
  private async handleAuthEvent(payload: any) {
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
          raw_user_meta_data: claims.user_metadata || {},
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
   * Test sync for a specific user
   */
  async testUserSync(userId: string) {
    this.logger.log(`Manual test sync for user: ${userId}`);
    
    try {
      // Mock user data for testing
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