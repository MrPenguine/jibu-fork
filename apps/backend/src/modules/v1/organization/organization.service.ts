import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

@Injectable()
export class OrganizationService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get the organizations that the user is a member of
   */
  async getUserOrganizations(userId: string) {
    const memberships = await this.prisma.organizationMembership.findMany({
      where: {
        userId,
      },
      include: {
        organization: true,
      },
    });

    return memberships.map(membership => ({
      ...membership.organization,
      role: membership.role,
    }));
  }

  /**
   * Get a specific organization by ID
   */
  async getOrganization(userId: string, id: string) {
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
  async createOrganization(userId: string, name: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name,
        },
      });
      
      const membership = await tx.organizationMembership.create({
        data: {
          organizationId: organization.id,
          userId: userId,
          role: 'owner',
        },
        include: {
          organization: true,
        },
      });
      
      await tx.user.update({
        where: { id: userId },
        data: { lastOrgId: organization.id },
      });
      
      return { organization, membership };
    });
    
    return {
      ...result.organization,
      role: result.membership.role,
    };
  }

  /**
   * Update an organization - requires owner or admin role
   */
  async updateOrganization(userId: string, id: string, updateData: any) {
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
    
    const updatedOrg = await this.prisma.organization.update({
      where: { id },
      data: {
        ...(updateData.name && { name: updateData.name }),
        ...(updateData.email && { email: updateData.email }),
        ...(updateData.settings && { settings: updateData.settings }),
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
  async deleteOrganization(userId: string, id: string) {
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
    
    await this.prisma.$transaction(async (tx) => {
      await tx.organizationMembership.deleteMany({
        where: { organizationId: id },
      });
      
      await tx.organization.delete({
        where: { id },
      });
      
      const user = await tx.user.findUnique({
        where: { id: userId },
      });
      
      if (user?.lastOrgId === id) {
        const anotherMembership = await tx.organizationMembership.findFirst({
          where: { 
            userId,
            organizationId: { not: id }
          },
        });
        
        await tx.user.update({
          where: { id: userId },
          data: { lastOrgId: anotherMembership?.organizationId || null },
        });
      }
    });
    
    return { message: 'Organization deleted successfully' };
  }
} 