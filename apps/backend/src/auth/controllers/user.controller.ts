import { Controller, Get, UseGuards, Request, Post, Body } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PrismaService } from '../../database/prisma.service';

@Controller('users')
export class UserController {
  constructor(private prisma: PrismaService) {}

  /**
   * Get current user information
   * This endpoint is protected by the JwtAuthGuard
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getCurrentUser(@Request() req: any) {
    // The user object is attached to the request by the JwtStrategy
    return req.user;
  }

  /**
   * Get the user's last organization or a default one if not set
   */
  @UseGuards(JwtAuthGuard)
  @Get('last-organization')
  async getLastOrganization(@Request() req: any) {
    const userId = req.user.id;

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
      throw new Error('User has no organizations');
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
  @UseGuards(JwtAuthGuard)
  @Post('last-organization')
  async updateLastOrganization(@Request() req: any, @Body() body: { organizationId: string }) {
    const userId = req.user.id;
    const { organizationId } = body;

    // Verify that the user is a member of the organization
    const membership = await this.prisma.organizationMembership.findFirst({
      where: {
        userId,
        organizationId,
      },
    });

    if (!membership) {
      throw new Error('User is not a member of this organization');
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