import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ApiKeyService } from '../../modules/v1/api-key/api-key.service';

@Injectable()
export class UserSyncService {
  private readonly logger = new Logger(UserSyncService.name);

  constructor(
    private prisma: PrismaService,
    private apiKeyService: ApiKeyService,
  ) {}

  /**
   * Sync a user from Supabase to our database
   */
  async syncUserFromSupabase(userData: any): Promise<any> {
    try {
      this.logger.log(`Syncing user: ${userData.id}`);

      // Check if user exists
      const existingUser = await this.prisma.user.findUnique({
        where: { id: userData.id },
      });

      if (existingUser) {
        // Update existing user
        return this.updateUser(userData);
      } else {
        // Create new user
        return this.createUser(userData);
      }
    } catch (error) {
      this.logger.error(`Error syncing user: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Create a new user in our database
   */
  private async createUser(supabaseUser: any): Promise<any> {
    const userMetadata = supabaseUser.user_metadata || {};
    const appMetadata = supabaseUser.app_metadata || {};

    // Create the user
    const user = await this.prisma.user.create({
      data: {
        id: supabaseUser.id,
        email: supabaseUser.email,
        emailConfirmed: !!supabaseUser.email_confirmed_at,
        firstName: userMetadata.first_name,
        lastName: userMetadata.last_name,
        fullName: userMetadata.full_name,
        imageUrl: userMetadata.avatar_url || userMetadata.picture, // Handle different possible fields
        provider: appMetadata.provider,
        providerIds: appMetadata.providers || [], // Ensure it's an array
        lastSignInAt: supabaseUser.last_sign_in_at ? new Date(supabaseUser.last_sign_in_at) : null,
        phoneNumber: supabaseUser.phone,
        phoneConfirmed: !!supabaseUser.phone_confirmed_at,
        isAnonymous: supabaseUser.is_anonymous || false,
        metadata: userMetadata, // Store the raw metadata
      },
    });

    // Create a default organization for the user
    const organization = await this.prisma.organization.create({
      data: {
        name: `${user.firstName || user.email}'s Organization`,
        memberships: {
          create: {
            userId: user.id,
            role: 'owner', // Default role is owner for created org
            status: 'active', // Ensure the membership is active
          },
        },
      },
    });

    // Update the user's lastOrgId to point to this organization
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastOrgId: organization.id }
    });

    // Create default API keys for the user
    await this.apiKeyService.ensureDefaultKeysForUser(organization.id, user.id);

    this.logger.log(`Created new user, organization, and default API keys: ${user.id}, ${organization.id}`);
    return { user, organization };
  }

  /**
   * Update an existing user in our database
   */
  private async updateUser(supabaseUser: any): Promise<any> {
    const userMetadata = supabaseUser.user_metadata || {};
    const appMetadata = supabaseUser.app_metadata || {};

    const user = await this.prisma.user.update({
      where: { id: supabaseUser.id },
      data: {
        email: supabaseUser.email,
        emailConfirmed: !!supabaseUser.email_confirmed_at,
        firstName: userMetadata.first_name,
        lastName: userMetadata.last_name,
        fullName: userMetadata.full_name,
        imageUrl: userMetadata.avatar_url || userMetadata.picture,
        provider: appMetadata.provider,
        providerIds: appMetadata.providers || [],
        lastSignInAt: supabaseUser.last_sign_in_at ? new Date(supabaseUser.last_sign_in_at) : null,
        phoneNumber: supabaseUser.phone,
        phoneConfirmed: !!supabaseUser.phone_confirmed_at,
        isAnonymous: supabaseUser.is_anonymous || false,
        metadata: userMetadata,
        updatedAt: new Date(), // Explicitly set updatedAt
      },
    });

    this.logger.log(`Updated user: ${user.id}`);
    return { user };
  }

  /**
   * Handle user deletion
   */
  async handleUserDeletion(userId: string): Promise<void> {
    this.logger.log(`Handling user deletion: ${userId}`);
    
    // The cascading delete in the schema will handle membership removal
    await this.prisma.user.delete({
      where: { id: userId },
    });
    
    this.logger.log(`User deleted: ${userId}`);
  }
}