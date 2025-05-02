import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { v4 as uuidv4 } from 'uuid';
import { add } from 'date-fns';
import { InviteMembersDto } from './dto/organization.dto';

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
      status: membership.status,
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
      status: membership.status,
    };
  }

  /**
   * Create a new organization and make the current user the owner
   */
  async createOrganization(userId: string, name: string) {
    if (!name || typeof name !== 'string') {
      throw new HttpException('Organization name is required', HttpStatus.BAD_REQUEST);
    }

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
          status: 'active',
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
      status: result.membership.status,
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
      status: membership.status,
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

  /**
   * Invite members to an organization - requires owner or admin role
   */
  async inviteMembers(userId: string, organizationId: string, inviteData: InviteMembersDto) {
    // Check if user has permission to invite (owner or admin)
    const userMembership = await this.prisma.organizationMembership.findFirst({
      where: {
        userId,
        organizationId,
        role: { in: ['owner', 'admin'] },
        status: 'active',
      },
      include: {
        organization: true,
      },
    });
    
    if (!userMembership) {
      throw new HttpException(
        'Access denied. Owner or admin role required to invite members.',
        HttpStatus.FORBIDDEN
      );
    }

    const organization = userMembership.organization;
    const invitedEmails = inviteData.emails;
    const role = inviteData.role;
    const message = inviteData.message;

    if (!invitedEmails || invitedEmails.length === 0) {
      throw new HttpException('No email addresses provided for invitation.', HttpStatus.BAD_REQUEST);
    }

    // Validate role
    const validRoles = ['admin', 'editor', 'viewer'];
    if (!validRoles.includes(role)) {
      throw new HttpException(`Invalid role: ${role}. Must be one of: ${validRoles.join(', ')}`, HttpStatus.BAD_REQUEST);
    }

    const results = await Promise.all(
      invitedEmails.map(async (email) => {
        try {
          // Check if user with this email already exists
          const existingUser = await this.prisma.user.findUnique({
            where: { email },
          });

          // Check if there's already a membership for this user/org or email/org
          const existingMembership = await this.prisma.organizationMembership.findFirst({
            where: {
              organizationId,
              OR: [
                { userId: existingUser?.id },
                { email },
              ],
            },
          });

          if (existingMembership) {
            return {
              email,
              status: 'already_member',
              message: 'User is already a member or has a pending invitation.',
            };
          }

          // Generate unique token for the invitation
          const token = uuidv4();
          // Set expiration date (30 days from now)
          const expiresAt = add(new Date(), { days: 30 });

          return await this.prisma.$transaction(async (tx) => {
            // Create membership record with email field
            const membership = await tx.organizationMembership.create({
              data: {
                organizationId,
                userId: existingUser?.id,
                email,
                role,
                status: 'pending',
              },
            });

            // Create invitation record
            const invitation = await tx.invitation.create({
              data: {
                email,
                organizationId,
                role,
                token,
                invitedById: userId,
                status: 'pending',
                message,
                expiresAt,
              },
              include: {
                organization: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            });

            return {
              email,
              status: 'invited',
              invitationId: invitation.id,
              token: invitation.token,
            };
          });
        } catch (error) {
          console.error(`Error inviting ${email}:`, error);
          return {
            email,
            status: 'error',
            message: error.message || 'Failed to create invitation',
          };
        }
      })
    );

    return {
      organization: {
        id: organization.id,
        name: organization.name,
      },
      invitations: results,
    };
  }

  /**
   * Get pending invitations for a user by email
   */
  async getUserInvitations(email: string) {
    const invitations = await this.prisma.invitation.findMany({
      where: {
        email,
        status: 'pending',
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        invitedBy: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });

    return invitations.map(invitation => ({
      id: invitation.id,
      organizationId: invitation.organizationId,
      organization: invitation.organization,
      role: invitation.role,
      invitedBy: invitation.invitedBy,
      invitedAt: invitation.createdAt,
      expiresAt: invitation.expiresAt,
      message: invitation.message,
    }));
  }

  /**
   * Accept or reject an invitation
   */
  async respondToInvitation(userId: string, invitationId: string, action: 'accept' | 'reject') {
    const invitation = await this.prisma.invitation.findUnique({
      where: { id: invitationId },
      include: {
        organization: true,
      },
    });

    if (!invitation) {
      throw new HttpException('Invitation not found.', HttpStatus.NOT_FOUND);
    }

    if (invitation.status !== 'pending') {
      throw new HttpException(
        `Invitation already ${invitation.status}.`, 
        HttpStatus.BAD_REQUEST
      );
    }

    // Check if invitation belongs to the current user by email
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.email !== invitation.email) {
      throw new HttpException(
        'This invitation was not intended for you.', 
        HttpStatus.FORBIDDEN
      );
    }

    if (action === 'reject') {
      // Reject invitation
      await this.prisma.$transaction(async (tx) => {
        await tx.invitation.update({
          where: { id: invitationId },
          data: { status: 'rejected' },
        });

        // Find and update the associated membership
        await tx.organizationMembership.updateMany({
          where: {
            organizationId: invitation.organizationId,
            email: invitation.email,
            status: 'pending',
          },
          data: { status: 'rejected' },
        });
      });

      return { message: 'Invitation rejected successfully.' };
    } else {
      // Accept invitation
      await this.prisma.$transaction(async (tx) => {
        await tx.invitation.update({
          where: { id: invitationId },
          data: { status: 'accepted' },
        });

        // Update the membership to link it with the user and set status to active
        await tx.organizationMembership.updateMany({
          where: {
            organizationId: invitation.organizationId,
            email: invitation.email,
            status: 'pending',
          },
          data: {
            userId,
            status: 'active',
          },
        });
      });

      return {
        message: 'Invitation accepted successfully.',
        organization: {
          id: invitation.organization.id,
          name: invitation.organization.name,
          role: invitation.role,
        },
      };
    }
  }

  /**
   * Get all members of an organization
   */
  async getOrganizationMembers(userId: string, organizationId: string) {
    // Check if user is a member of the organization and has access
    const userMembership = await this.prisma.organizationMembership.findFirst({
      where: {
        userId,
        organizationId,
      },
    });

    if (!userMembership) {
      throw new HttpException(
        'Access denied. You are not a member of this organization.',
        HttpStatus.FORBIDDEN
      );
    }
    
    // Only allow active members with appropriate roles to view members
    if (userMembership.status !== 'active') {
      throw new HttpException(
        'Access denied. Your membership is not active.',
        HttpStatus.FORBIDDEN
      );
    }

    // Get all members of the organization
    const members = await this.prisma.organizationMembership.findMany({
      where: {
        organizationId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            fullName: true,
            imageUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return members.map(member => ({
      id: member.id,
      organizationId: member.organizationId,
      userId: member.userId,
      email: member.email || member.user?.email,
      role: member.role,
      status: member.status,
      user: member.user,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
    }));
  }

  /**
   * Update a member's role in an organization
   */
  async updateMemberRole(
    userId: string, 
    organizationId: string, 
    memberId: string, 
    newRole: string
  ) {
    // Check if user is a member of the organization and has permission to update roles
    const userMembership = await this.prisma.organizationMembership.findFirst({
      where: {
        userId,
        organizationId,
        status: 'active',
      },
    });

    if (!userMembership) {
      throw new HttpException(
        'Access denied. You are not an active member of this organization.',
        HttpStatus.FORBIDDEN
      );
    }

    // Find the member to update
    const memberToUpdate = await this.prisma.organizationMembership.findUnique({
      where: { id: memberId },
      include: { user: { select: { id: true } } },
    });

    if (!memberToUpdate || memberToUpdate.organizationId !== organizationId) {
      throw new HttpException('Member not found in this organization.', HttpStatus.NOT_FOUND);
    }

    // Check if current user can update this member based on roles
    if (userMembership.role === 'owner') {
      // Owner can update anyone except themselves
      if (memberToUpdate.userId === userId) {
        throw new HttpException(
          'You cannot change your own role as an owner.',
          HttpStatus.FORBIDDEN
        );
      }
    } else if (userMembership.role === 'admin') {
      // Admin can update editors only, not owners or other admins
      if (memberToUpdate.role === 'owner' || memberToUpdate.role === 'admin' || memberToUpdate.userId === userId) {
        throw new HttpException(
          'Admins can only change the roles of editors, not owners, other admins, or themselves.',
          HttpStatus.FORBIDDEN
        );
      }

      // Admin can only assign editor role
      if (newRole !== 'editor') {
        throw new HttpException(
          'Admins can only assign the editor role.',
          HttpStatus.FORBIDDEN
        );
      }
    } else {
      // Editors and viewers cannot update roles
      throw new HttpException(
        'Only owners and admins can update member roles.',
        HttpStatus.FORBIDDEN
      );
    }

    // Validate the new role
    if (!['owner', 'admin', 'editor', 'viewer'].includes(newRole)) {
      throw new HttpException('Invalid role specified.', HttpStatus.BAD_REQUEST);
    }

    // Update the member's role
    const updatedMember = await this.prisma.organizationMembership.update({
      where: { id: memberId },
      data: { role: newRole },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            fullName: true,
          },
        },
      },
    });

    return {
      id: updatedMember.id,
      organizationId: updatedMember.organizationId,
      userId: updatedMember.userId,
      email: updatedMember.email || updatedMember.user?.email,
      role: updatedMember.role,
      status: updatedMember.status,
      user: updatedMember.user,
      createdAt: updatedMember.createdAt,
      updatedAt: updatedMember.updatedAt,
    };
  }

  /**
   * Remove a member from an organization
   */
  async removeMember(userId: string, organizationId: string, memberId: string) {
    // Check if user is a member of the organization and has permission to remove members
    const userMembership = await this.prisma.organizationMembership.findFirst({
      where: {
        userId,
        organizationId,
        status: 'active',
      },
    });

    if (!userMembership) {
      throw new HttpException(
        'Access denied. You are not an active member of this organization.',
        HttpStatus.FORBIDDEN
      );
    }

    // Find the member to remove
    const memberToRemove = await this.prisma.organizationMembership.findUnique({
      where: { id: memberId },
      include: { user: { select: { id: true } } },
    });

    if (!memberToRemove || memberToRemove.organizationId !== organizationId) {
      throw new HttpException('Member not found in this organization.', HttpStatus.NOT_FOUND);
    }

    // Special case: User is removing themselves (leaving the organization)
    const isSelfRemoval = memberToRemove.userId === userId;
    
    if (isSelfRemoval) {
      // Owner can't leave without transferring ownership first
      if (memberToRemove.role === 'owner') {
        throw new HttpException(
          'You cannot remove yourself as an owner. Transfer ownership first.',
          HttpStatus.FORBIDDEN
        );
      }
      
      // User is leaving the organization - allow this regardless of role
      await this.prisma.organizationMembership.delete({
        where: { id: memberId },
      });
      
      return { message: 'You have left the organization successfully.' };
    }
    
    // Normal case: User is removing someone else
    
    // Check if current user can remove this member based on roles
    if (userMembership.role === 'owner') {
      // Owner can remove anyone except themselves (handled above)
    } else if (userMembership.role === 'admin') {
      // Admin can remove editors only, not owners or other admins
      if (memberToRemove.role === 'owner' || memberToRemove.role === 'admin') {
        throw new HttpException(
          'Admins can only remove editors, not owners or other admins.',
          HttpStatus.FORBIDDEN
        );
      }
    } else {
      // Editors and viewers cannot remove members
      throw new HttpException(
        'Only owners and admins can remove members.',
        HttpStatus.FORBIDDEN
      );
    }

    // Remove the member
    await this.prisma.organizationMembership.delete({
      where: { id: memberId },
    });

    return { message: 'Member removed successfully.' };
  }

  /**
   * Transfer ownership to another member
   */
  async transferOwnership(userId: string, organizationId: string, newOwnerId: string) {
    // Check if the current user is the owner of the organization
    const currentOwnerMembership = await this.prisma.organizationMembership.findFirst({
      where: {
        userId,
        organizationId,
        role: 'owner',
        status: 'active',
      },
    });

    if (!currentOwnerMembership) {
      throw new HttpException(
        'Access denied. Only the current owner can transfer ownership.',
        HttpStatus.FORBIDDEN
      );
    }

    // Check if the new owner is a member of the organization
    const newOwnerMembership = await this.prisma.organizationMembership.findUnique({
      where: { id: newOwnerId },
      include: { user: { select: { id: true, email: true } } },
    });

    if (!newOwnerMembership || newOwnerMembership.organizationId !== organizationId) {
      throw new HttpException('The specified member was not found in this organization.', HttpStatus.NOT_FOUND);
    }

    if (newOwnerMembership.status !== 'active') {
      throw new HttpException(
        'Cannot transfer ownership to a member with a non-active status.',
        HttpStatus.BAD_REQUEST
      );
    }

    // Perform the transfer in a transaction
    await this.prisma.$transaction(async (tx) => {
      // Demote the current owner to admin
      await tx.organizationMembership.update({
        where: { id: currentOwnerMembership.id },
        data: { role: 'admin' },
      });

      // Promote the new member to owner
      await tx.organizationMembership.update({
        where: { id: newOwnerId },
        data: { role: 'owner' },
      });
    });

    return {
      message: 'Ownership transferred successfully.',
      newOwner: {
        id: newOwnerMembership.id,
        userId: newOwnerMembership.userId,
        email: newOwnerMembership.user?.email,
      },
    };
  }

  /**
   * Validate an email address before invitation
   * Checks if user exists, if they are already a member, and if they have a pending invitation
   */
  async validateEmail(userId: string, organizationId: string, email: string) {
    // Check if user has permission to invite members
    const userMembership = await this.prisma.organizationMembership.findFirst({
      where: {
        userId,
        organizationId,
        status: 'active',
        role: { in: ['owner', 'admin'] }
      },
    });

    if (!userMembership) {
      throw new HttpException(
        'Access denied. Only owners and admins can invite members.',
        HttpStatus.FORBIDDEN
      );
    }

    // Check if the email is already registered to an active member in this organization
    const existingMembership = await this.prisma.organizationMembership.findFirst({
      where: {
        organizationId,
        OR: [
          { 
            user: {
              email
            } 
          }
        ],
        status: 'active'
      }
    });

    if (existingMembership) {
      return {
        valid: false,
        reason: 'exists',
        message: 'This user is already a member of this organization.'
      };
    }

    // Check if there's a pending invitation for this email
    const pendingInvitation = await this.prisma.invitation.findFirst({
      where: {
        email,
        organizationId,
        status: 'pending'
      }
    });

    if (pendingInvitation) {
      return {
        valid: false,
        reason: 'already-invited',
        message: 'An invitation has already been sent to this email address.'
      };
    }

    // Check if the email exists in the system
    const user = await this.prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return {
        valid: false,
        reason: 'not-registered',
        message: 'This email is not registered. The user needs to sign up first.'
      };
    }

    // Email validation passed
    return {
      valid: true,
      message: 'User exists and can be invited.'
    };
  }
} 