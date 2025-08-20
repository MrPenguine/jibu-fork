import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { supabaseAdmin } from '../../../core/supabase/admin';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get the user's last workspace or a default one if not set
   */
  async getLastWorkspace(userId: string) {
    // Get the user with their last workspace
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { lastWorkspace: true },
    });

    // If user has a last workspace, return it
    if (user?.lastWorkspaceId && user?.lastWorkspace) {
      return {
        workspace: user.lastWorkspace,
        isDefault: false,
      };
    }

    // Otherwise, find the first workspace the user is a member of
    const membership = await this.prisma.workspaceMembership.findFirst({
      where: { userId },
      include: { workspace: true },
    });

    if (!membership) {
      throw new NotFoundException('User has no workspaces');
    }

    // Update the user's lastWorkspaceId
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastWorkspaceId: membership.workspaceId },
    });

    return {
      workspace: membership.workspace,
      isDefault: true,
    };
  }

  /**
   * Update the user's last workspace
   */
  async updateLastWorkspace(userId: string, workspaceId: string) {
    // Verify that the user is a member of the workspace
    const membership = await this.prisma.workspaceMembership.findFirst({
      where: {
        userId,
        workspaceId,
      },
    });

    if (!membership) {
      throw new NotFoundException('User is not a member of this workspace');
    }

    // Update the user's lastWorkspaceId
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { lastWorkspaceId: workspaceId },
      include: { lastWorkspace: true },
    });

    return updatedUser;
  }

  /**
   * Delete the current user account
   */
  async deleteUserAccount(userId: string): Promise<void> {
    // Delete the user from Supabase Auth
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) {
      throw new Error(`Failed to delete user from Supabase Auth: ${error.message}`);
    }
    // Delete the user from the database
    await this.prisma.user.delete({ where: { id: userId } });
  }
}