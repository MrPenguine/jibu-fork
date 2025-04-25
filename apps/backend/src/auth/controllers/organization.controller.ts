import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PrismaService } from '../../database/prisma.service';

@Controller('organizations')
export class OrganizationController {
  constructor(private prisma: PrismaService) {}

  /**
   * Get the organizations that the current user is a member of
   */
  @UseGuards(JwtAuthGuard)
  @Get()
  async getUserOrganizations(@Request() req: any) {
    const userId = req.user.id;

    // Get all organizations the user is a member of
    const memberships = await this.prisma.organizationMembership.findMany({
      where: {
        userId,
      },
      include: {
        organization: true,
      },
    });

    // Return the organizations with role information
    return memberships.map(membership => ({
      ...membership.organization,
      role: membership.role,
    }));
  }
} 