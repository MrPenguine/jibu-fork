import { Controller, Get, Post, Put, Delete, UseGuards, Request, Body, Param, HttpException, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PrismaService } from '../../database/prisma.service';

class CreateOrganizationDto {
  name: string;
}

class UpdateOrganizationDto {
  name?: string;
  email?: string;
  settings?: {
    channel?: string;
    callConcurrencyLimit?: number;
    hipaaEnabled?: boolean;
    pciEnabled?: boolean;
    serverUrl?: string;
    timeoutSeconds?: number;
    headers?: { name: string; value: string }[];
  };
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
   * Get a specific organization by ID
   */
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getOrganization(@Request() req: any, @Param('id') id: string) {
    const userId = req.user.id;
    
    // Check if the user is a member of this organization
    const membership = await this.prisma.organizationMembership.findFirst({
      where: {
        userId,
        organizationId: id,
      },
      include: {
        organization: true,
      },
    });
    
    if (!membership) {
      throw new HttpException('Organization not found or you do not have access', HttpStatus.NOT_FOUND);
    }
    
    return {
      ...membership.organization,
      role: membership.role,
    };
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
  
  /**
   * Update an organization - requires owner or admin role
   */
  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async updateOrganization(
    @Request() req: any, 
    @Param('id') id: string, 
    @Body() updateOrgDto: UpdateOrganizationDto
  ) {
    const userId = req.user.id;
    
    // Check if the user is a member with owner or admin role
    const membership = await this.prisma.organizationMembership.findFirst({
      where: {
        userId,
        organizationId: id,
        role: { in: ['owner', 'admin'] },
      },
    });
    
    if (!membership) {
      throw new HttpException('Access denied. Owner or admin role required.', HttpStatus.FORBIDDEN);
    }
    
    // Update the organization
    const updatedOrg = await this.prisma.organization.update({
      where: { id },
      data: {
        ...(updateOrgDto.name && { name: updateOrgDto.name }),
        ...(updateOrgDto.email && { email: updateOrgDto.email }),
        // Directly pass the settings as JSON
        ...(updateOrgDto.settings && { settings: updateOrgDto.settings }),
      },
    });
    
    return {
      ...updatedOrg,
      role: membership.role,
    };
  }
  
  /**
   * Delete an organization - requires owner role
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deleteOrganization(@Request() req: any, @Param('id') id: string) {
    const userId = req.user.id;
    
    // Check if the user is the owner
    const membership = await this.prisma.organizationMembership.findFirst({
      where: {
        userId,
        organizationId: id,
        role: 'owner',
      },
    });
    
    if (!membership) {
      throw new HttpException('Access denied. Only the owner can delete an organization.', HttpStatus.FORBIDDEN);
    }
    
    // Delete the organization and all related data in a transaction
    await this.prisma.$transaction(async (tx) => {
      // First delete all memberships
      await tx.organizationMembership.deleteMany({
        where: { organizationId: id },
      });
      
      // Then delete the organization itself
      await tx.organization.delete({
        where: { id },
      });
      
      // Get user info
      const user = await tx.user.findUnique({
        where: { id: userId },
      });
      
      // If the deleted org was the user's active org, find another org to set as active
      if (user?.lastOrgId === id) {
        // Find another organization membership for this user
        const anotherMembership = await tx.organizationMembership.findFirst({
          where: { 
            userId,
            organizationId: { not: id }
          },
        });
        
        // Update the user's lastOrgId to the new organization or null if none exists
        await tx.user.update({
          where: { id: userId },
          data: { lastOrgId: anotherMembership?.organizationId || null },
        });
      }
    });
    
    return { message: 'Organization deleted successfully' };
  }
} 