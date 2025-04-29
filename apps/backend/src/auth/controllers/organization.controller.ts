import { Controller, Get, Post, UseGuards, Request, Body } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PrismaService } from '../../database/prisma.service';

class CreateOrganizationDto {
  name: string;
}

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
  
  /**
   * Create a new organization and make the current user the owner
   */
  @UseGuards(JwtAuthGuard)
  @Post()
  async createOrganization(@Request() req: any, @Body() createOrgDto: CreateOrganizationDto) {
    const userId = req.user.id;
    
    // Create the organization and membership in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create new organization
      const organization = await tx.organization.create({
        data: {
          name: createOrgDto.name,
        },
      });
      
      // Create membership for current user as owner
      const membership = await tx.organizationMembership.create({
        data: {
          organizationId: organization.id,
          userId: userId,
          role: 'owner', // Set the user as the owner
        },
        include: {
          organization: true,
        },
      });
      
      // Update user's lastOrgId to this new organization
      await tx.user.update({
        where: { id: userId },
        data: { lastOrgId: organization.id },
      });
      
      return { organization, membership };
    });
    
    // Return the new organization with role
    return {
      ...result.organization,
      role: result.membership.role,
    };
  }
} 