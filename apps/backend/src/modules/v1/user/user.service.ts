import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get the user's last organization or a default one if not set
   */
  async getLastOrganization(userId: string) {
    // Get the user with their last organization
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { lastOrg: true },
    });

    // If user has a last organization, return it
    if (user?.lastOrgId && user?.lastOrg) {
      return {
        organization: user.lastOrg,
        isDefault: false,
      };
    }

    // Otherwise, find the first organization the user is a member of
    const membership = await this.prisma.organizationMembership.findFirst({
      where: { userId },
      include: { organization: true },
    });

    if (!membership) {
      throw new NotFoundException('User has no organizations');
    }

    // Update the user's lastOrgId
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastOrgId: membership.organizationId },
    });

    return {
      organization: membership.organization,
      isDefault: true,
    };
  }

  /**
   * Update the user's last organization
   */
  async updateLastOrganization(userId: string, organizationId: string) {
    // Verify that the user is a member of the organization
    const membership = await this.prisma.organizationMembership.findFirst({
      where: {
        userId,
        organizationId,
      },
    });

    if (!membership) {
      throw new NotFoundException('User is not a member of this organization');
    }

    // Update the user's lastOrgId
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { lastOrgId: organizationId },
      include: { lastOrg: true },
    });

    return {
      organization: updatedUser.lastOrg,
    };
  }
}