import { Controller, Get, UseGuards, Request, Post, Body, Delete, NotFoundException } from '@nestjs/common';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { UserService } from './user.service';
import { PrismaService } from '../../../core/database/prisma.service';

class UpdateLastOrgDto {
  organizationId: string;
}

@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly prisma: PrismaService
  ) {}

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
   * Get user context including organization information
   */
  @UseGuards(JwtAuthGuard)
  @Get('context')
  async getUserContext(@Request() req: any) {
    const user = req.user; // User object from JwtStrategy

    if (!user.lastOrgId) {
      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        orgId: null,
        orgName: null,
        orgRole: null,
        membershipStatus: null,
      };
    }

    const membership = await this.prisma.organizationMembership.findFirst({
      where: {
        userId: user.id,
        organizationId: user.lastOrgId,
      },
      include: {
        organization: true,
      },
    });

    if (!membership) {
      throw new NotFoundException(`Membership not found for organization ${user.lastOrgId}`);
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      orgId: membership.organizationId,
      orgName: membership.organization.name,
      orgRole: membership.role,
      membershipStatus: membership.status,
    };
  }

  /**
   * Get the user's last organization or a default one if not set
   */
  @UseGuards(JwtAuthGuard)
  @Get('last-organization')
  async getLastOrganization(@Request() req: any) {
    return this.userService.getLastOrganization(req.user.id);
  }

  /**
   * Update the user's last organization
   */
  @UseGuards(JwtAuthGuard)
  @Post('last-organization')
  async updateLastOrganization(@Request() req: any, @Body() body: UpdateLastOrgDto) {
    return this.userService.updateLastOrganization(req.user.id, body.organizationId);
  }

  /**
   * Delete the current user account
   */
  @UseGuards(JwtAuthGuard)
  @Delete('me')
  async deleteMyAccount(@Request() req: any) {
    await this.userService.deleteUserAccount(req.user.id);
    return { message: 'Account deleted successfully' };
  }
} 