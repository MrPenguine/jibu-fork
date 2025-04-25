import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('users')
export class UserController {
  constructor() {}

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
} 