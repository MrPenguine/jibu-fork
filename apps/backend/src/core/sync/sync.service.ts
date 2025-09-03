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
      try {
        return await this.createUser(userData);
      } catch (error) {
        // Handle race condition where user was created by another process
        if (error.code === 'P2002') {
          this.logger.warn(`User already created by another process, fetching existing user: ${userData.id}`);
          // Retry with exponential backoff in case the other transaction hasn't committed yet
          let fetched = null as any;
          for (let attempt = 1; attempt <= 12; attempt++) {
            fetched = await this.prisma.user.findUnique({ where: { id: userData.id } });
            if (fetched) break;
            const delay = Math.min(1000, 75 * 2 ** (attempt - 1));
            this.logger.debug(`Waiting ${delay}ms before retrying to fetch user ${userData.id} (attempt ${attempt}/12)`);
            await new Promise((r) => setTimeout(r, delay));
          }

          // If still not found by id, try resolving by unique email (likely the conflicting field)
          if (!fetched && userData.email) {
            const emailLower = (userData.email || '').toLowerCase();
            const byEmail = await this.prisma.user.findUnique({ where: { email: emailLower } });
            if (byEmail) {
              this.logger.warn(
                `Resolved user by email after P2002 conflict: ${emailLower} -> id ${byEmail.id}`,
              );
              fetched = byEmail;
            }
          }

          // Even if fetched is still null, return consistent shape to caller
          if (fetched?.id) {
            // Ensure user has a default workspace and membership
            const workspaceId = await this.ensureDefaultWorkspaceForUser(fetched.id);
            // Best-effort: ensure default API keys
            try {
              await this.apiKeyService.ensureDefaultKeysForUser(workspaceId, fetched.id);
            } catch (e: any) {
              this.logger.warn(
                `Default API key creation skipped for user ${fetched.id}: ${e?.message || e}`,
              );
            }
          }

          return { user: fetched };
        } else {
          this.logger.error(`Error creating user: ${error.message}`, error.stack);
          throw error;
        }
      }
    }
  }

  /**
   * Create a new user in our database
   */
  private async createUser(supabaseUser: any): Promise<any> {
    const userMetadata = supabaseUser.user_metadata || {};
    const appMetadata = supabaseUser.app_metadata || {};
    const providersFromApp = Array.isArray(appMetadata.providers)
      ? appMetadata.providers
      : [];
    const mergedProviderIds = Array.from(
      new Set([...(providersFromApp as string[]), supabaseUser.id].filter(Boolean)),
    );

    // Use a transaction to ensure all related data is created atomically
    // Create user and default workspace atomically
    const { user, workspace } = await this.prisma.$transaction(async (tx) => {
      // 1. Create the user
      const user = await tx.user.create({
        data: {
          id: supabaseUser.id,
          email: (supabaseUser.email || '').toLowerCase(),
          emailConfirmed: !!supabaseUser.email_confirmed_at,
          firstName: userMetadata.first_name,
          lastName: userMetadata.last_name,
          fullName: userMetadata.full_name,
          imageUrl: userMetadata.avatar_url || userMetadata.picture,
          provider: appMetadata.provider,
          providerIds: mergedProviderIds,
          lastSignInAt: supabaseUser.last_sign_in_at ? new Date(supabaseUser.last_sign_in_at) : null,
          phoneNumber: supabaseUser.phone,
          phoneConfirmed: !!supabaseUser.phone_confirmed_at,
          isAnonymous: supabaseUser.is_anonymous || false,
          metadata: userMetadata,
        },
      });

      // 2. Create the default workspace
      const workspace = await tx.workspace.create({
        data: {
          name: `${user.firstName || user.email}'s Workspace`,
          memberships: {
            create: {
              userId: user.id,
              role: 'owner',
              status: 'active',
            },
          },
        },
      });

      // 3. Update the user with the new workspace ID
      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: { lastWorkspaceId: workspace.id },
      });

      this.logger.log(`Created new user and workspace: ${user.id}, ${workspace.id}`);
      return { user: updatedUser, workspace };
    });

    // 4. Create default API keys, now outside of the transaction (best-effort)
    try {
      await this.apiKeyService.ensureDefaultKeysForUser(workspace.id, user.id);
      this.logger.log(`Created default API keys for user: ${user.id}`);
    } catch (e: any) {
      // Do not fail authentication if Vault or key creation fails
      this.logger.warn(
        `Default API key creation skipped for user ${user.id}: ${e?.message || e}`,
      );
    }

    return { user, workspace };
  }

  /**
   * Update an existing user in our database
   */
  private async updateUser(supabaseUser: any): Promise<any> {
    const userMetadata = supabaseUser.user_metadata || {};
    const appMetadata = supabaseUser.app_metadata || {};
    const existing = await this.prisma.user.findUnique({
      where: { id: supabaseUser.id },
      select: { providerIds: true },
    });
    const providersFromApp = Array.isArray(appMetadata.providers)
      ? appMetadata.providers
      : [];
    const mergedProviderIds = Array.from(
      new Set([...(existing?.providerIds || []), ...(providersFromApp as string[]), supabaseUser.id].filter(Boolean)),
    );

    const user = await this.prisma.user.update({
      where: { id: supabaseUser.id },
      data: {
        email: (supabaseUser.email || '').toLowerCase(),
        emailConfirmed: !!supabaseUser.email_confirmed_at,
        firstName: userMetadata.first_name,
        lastName: userMetadata.last_name,
        fullName: userMetadata.full_name,
        imageUrl: userMetadata.avatar_url || userMetadata.picture,
        provider: appMetadata.provider,
        providerIds: mergedProviderIds,
        lastSignInAt: supabaseUser.last_sign_in_at ? new Date(supabaseUser.last_sign_in_at) : null,
        phoneNumber: supabaseUser.phone,
        phoneConfirmed: !!supabaseUser.phone_confirmed_at,
        isAnonymous: supabaseUser.is_anonymous || false,
        metadata: userMetadata,
        updatedAt: new Date(), // Explicitly set updatedAt
      },
    });

    this.logger.log(`Updated user: ${user.id}`);
    // Ensure the user has a default workspace and membership
    const workspaceId = await this.ensureDefaultWorkspaceForUser(user.id);
    // Best-effort: ensure default API keys
    try {
      await this.apiKeyService.ensureDefaultKeysForUser(workspaceId, user.id);
    } catch (e: any) {
      this.logger.warn(
        `Default API key creation skipped for user ${user.id}: ${e?.message || e}`,
      );
    }

    return { user };
  }

  /**
   * Ensure the user has a default workspace and active membership. If none exists,
   * create one and set it as lastWorkspaceId. Returns the resolved workspaceId.
   */
  private async ensureDefaultWorkspaceForUser(userId: string): Promise<string> {
    // Check existing membership and user's last workspace
    const [userRecord, membership] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, firstName: true, lastWorkspaceId: true },
      }),
      this.prisma.workspaceMembership.findFirst({
        where: { userId },
        select: { workspaceId: true },
      }),
    ]);

    if (membership?.workspaceId) {
      if (!userRecord?.lastWorkspaceId) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { lastWorkspaceId: membership.workspaceId },
        });
      }
      return membership.workspaceId;
    }

    // No membership found — create a default workspace and membership atomically
    const createdWorkspaceId = await this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name: `${userRecord?.firstName || userRecord?.email || 'User'}'s Workspace`,
          memberships: {
            create: {
              userId,
              role: 'owner',
              status: 'active',
            },
          },
        },
      });
      await tx.user.update({ where: { id: userId }, data: { lastWorkspaceId: workspace.id } });
      return workspace.id;
    });

    this.logger.log(`Ensured default workspace ${createdWorkspaceId} for user ${userId}`);
    return createdWorkspaceId;
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