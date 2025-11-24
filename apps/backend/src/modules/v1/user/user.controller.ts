import { Controller, Get, UseGuards, Request, Post, Body, Delete, NotFoundException } from '@nestjs/common';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { UserService } from './user.service';
import { PrismaService } from '../../../core/database/prisma.service';

class UpdateLastWorkspaceDto {
  workspaceId: string;
}

@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly prisma: PrismaService,
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
   * Get user context including workspace information
   */
  @UseGuards(JwtAuthGuard)
  @Get('context')
  async getUserContext(@Request() req: any) {
    const user = req.user; // User object from JwtStrategy

    if (!user.lastWorkspaceId) {
      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          isAdmin: user.isAdmin,
          adminRole: user.adminRole,
        },
        workspaceId: null,
        workspaceName: null,
        workspaceRole: null,
        membershipStatus: null,
      };
    }

    const membership = await this.prisma.workspaceMembership.findFirst({
      where: {
        userId: user.id,
        workspaceId: user.lastWorkspaceId,
      },
      include: {
        workspace: true,
      },
    });

    if (!membership) {
      throw new NotFoundException(`Membership not found for workspace ${user.lastWorkspaceId}`);
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isAdmin: user.isAdmin,
        adminRole: user.adminRole,
      },
      workspaceId: membership.workspaceId,
      workspaceName: membership.workspace.name,
      workspaceRole: membership.role,
      membershipStatus: membership.status,
    };
  }

  /**
   * Get the user's last workspace or a default one if not set
   */
  @UseGuards(JwtAuthGuard)
  @Get('last-workspace')
  async getLastWorkspace(@Request() req: any) {
    return this.userService.getLastWorkspace(req.user.id);
  }

  /**
   * Update the user's last workspace
   */
  @UseGuards(JwtAuthGuard)
  @Post('last-workspace')
  async updateLastWorkspace(@Request() req: any, @Body() body: UpdateLastWorkspaceDto) {
    return this.userService.updateLastWorkspace(req.user.id, body.workspaceId);
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