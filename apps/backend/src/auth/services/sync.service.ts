import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class UserSyncService {
  private readonly logger = new Logger(UserSyncService.name);

  constructor(private prisma: PrismaService) {}

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
  private async createUser(userData: any): Promise<any> {
    // Create the user
    const user = await this.prisma.user.create({
      data: {
        id: userData.id,
        email: userData.email,
        firstName: userData.user_metadata?.first_name,
        lastName: userData.user_metadata?.last_name,
        imageUrl: userData.user_metadata?.avatar_url,
      },
    });

    // Create a default organization for the user
    const organization = await this.prisma.organization.create({
      data: {
        name: `${user.firstName || user.email}'s Organization`,
        memberships: {
          create: {
            userId: user.id,
            role: 'admin', // Default role is admin for created org
          },
        },
      },
    });

    this.logger.log(`Created new user and organization: ${user.id}, ${organization.id}`);
    return { user, organization };
  }

  /**
   * Update an existing user in our database
   */
  private async updateUser(userData: any): Promise<any> {
    const user = await this.prisma.user.update({
      where: { id: userData.id },
      data: {
        email: userData.email,
        firstName: userData.user_metadata?.first_name,
        lastName: userData.user_metadata?.last_name,
        imageUrl: userData.user_metadata?.avatar_url,
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