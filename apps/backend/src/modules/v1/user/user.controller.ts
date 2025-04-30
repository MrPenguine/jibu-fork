import { Controller, Get, UseGuards, Request, Post, Body } from '@nestjs/common';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { UserService } from './user.service';

class UpdateLastOrgDto {
  organizationId: string;
}

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

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
} 