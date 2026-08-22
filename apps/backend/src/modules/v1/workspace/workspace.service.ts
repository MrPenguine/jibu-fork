import { Injectable, HttpException, HttpStatus, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { ApiKeyService } from '../api-key/api-key.service';
import { InviteMembersDto } from './dto/workspace.dto';
import { ConfigService } from '@nestjs/config';
import { randomUUID, randomBytes } from 'crypto';
import { VaultService } from '../../../core/encryption/vault.service';
import { auth } from '../../../core/auth/auth';

@Injectable()
export class WorkspaceService {
  private readonly logger = new Logger(WorkspaceService.name);
  constructor(
    private prisma: PrismaService,
    private apiKeyService: ApiKeyService,
    private configService: ConfigService,
    private vaultService: VaultService,
  ) {}

  /**
   * Get the workspaces that the user is a member of
   */
  async getUserWorkspaces(userId: string) {
    const memberships = await this.prisma.workspaceMembership.findMany({
      where: {
        userId,
        status: 'active',
      },
      include: {
        workspace: true,
      },
    });

    return memberships.map(membership => ({
      ...membership.workspace,
      role: membership.role,
      status: membership.status,
    }));
  }

  /**
   * Get a specific workspace by ID
   */
  async getWorkspace(userId: string, id: string) {
    const membership = await this.prisma.workspaceMembership.findFirst({
      where: {
        userId,
        workspaceId: id,
        status: 'active',
      },
      include: {
        workspace: true,
      },
    });
    
    if (!membership) {
      throw new HttpException('Workspace not found or you do not have access', HttpStatus.NOT_FOUND);
    }
    
    return {
      ...membership.workspace,
      role: membership.role,
      status: membership.status,
    };
  }

  /**
   * Create a new workspace and make the current user the owner
   */
  async createWorkspace(userId: string, name: string, headers: Headers) {
    if (!name || typeof name !== 'string') {
      throw new HttpException('Workspace name is required', HttpStatus.BAD_REQUEST);
    }

    const slug = `${name}-${randomUUID().slice(0, 8)}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-');
    const organization = await auth.api.createOrganization({
      body: { name, slug },
      headers,
    });
    await auth.api.setActiveOrganization({
      body: { organizationId: organization.id },
      headers,
    });
    const result = await this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.findUniqueOrThrow({
        where: { id: organization.id },
      });
      const membership = await tx.workspaceMembership.findFirstOrThrow({
        where: { workspaceId: workspace.id, userId },
      });
      
      await tx.user.update({
        where: { id: userId },
        data: { lastWorkspaceId: workspace.id },
      });

      // Create default API keys for the workspace within the transaction
      const apiKeyId = randomUUID();
      const apiKey = 'sk_' + randomBytes(32).toString('hex');
      const prefix = apiKey.slice(0, 10);
      
      // Create private key
      await this.vaultService.writeSecret('apiKeys', workspace.id, apiKeyId, { apiKey }, workspace.id);
      await tx.apiKey.create({
        data: {
          id: apiKeyId,
          workspaceId: workspace.id,
          userId: userId,
          name: "Default Private Key",
          prefix,
          scopes: [],
        },
      });

      // Create public key
      const publicApiKeyId = randomUUID();
      const publicApiKey = 'sk_' + randomBytes(32).toString('hex');
      const publicPrefix = publicApiKey.slice(0, 10);
      await this.vaultService.writeSecret('apiKeys', workspace.id, publicApiKeyId, { apiKey: publicApiKey }, workspace.id);
      await tx.apiKey.create({
        data: {
          id: publicApiKeyId,
          workspaceId: workspace.id,
          userId: userId,
          name: "Default Public Key",
          prefix: publicPrefix,
          scopes: [],
        },
      });
      
      return { workspace, membership };
    });
    
    return {
      ...result.workspace,
      role: result.membership.role,
      status: result.membership.status,
    };
  }

  /**
   * Update an workspace - requires owner or admin role
   */
  async updateWorkspace(userId: string, id: string, updateData: any) {
    const membership = await this.prisma.workspaceMembership.findFirst({
      where: {
        userId,
        workspaceId: id,
        role: { in: ['owner', 'admin'] },
      },
    });
    
    if (!membership) {
      throw new HttpException('Access denied. Owner or admin role required.', HttpStatus.FORBIDDEN);
    }
    
    const updatedOrg = await this.prisma.workspace.update({
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
   * Delete an workspace - requires owner role
   */
  async deleteWorkspace(userId: string, id: string) {
    const membership = await this.prisma.workspaceMembership.findFirst({
      where: {
        userId,
        workspaceId: id,
        role: 'owner',
      },
    });
    
    if (!membership) {
      throw new HttpException('Access denied. Only the owner can delete an workspace.', HttpStatus.FORBIDDEN);
    }
    
    await this.prisma.$transaction(async (tx) => {
      await tx.workspaceMembership.deleteMany({
        where: { workspaceId: id },
      });
      
      await tx.workspace.delete({
        where: { id },
      });
      
      const user = await tx.user.findUnique({
        where: { id: userId },
      });
      
      if (user?.lastWorkspaceId === id) {
        const anotherMembership = await tx.workspaceMembership.findFirst({
          where: { 
            userId,
            workspaceId: { not: id }
          },
        });
        
        await tx.user.update({
          where: { id: userId },
          data: { lastWorkspaceId: anotherMembership?.workspaceId || null },
        });
      }
    });
    
    return { message: 'Workspace deleted successfully' };
  }

  /**
   * Invite members to an workspace - requires owner or admin role
   */
  async inviteMembers(
    userId: string,
    workspaceId: string,
    inviteData: InviteMembersDto,
    headers: Headers,
  ) {
    // Check if user has permission to invite (owner or admin)
    const userMembership = await this.prisma.workspaceMembership.findFirst({
      where: {
        userId,
        workspaceId,
        role: { in: ['owner', 'admin'] },
        status: 'active',
      },
      include: {
        workspace: true,
      },
    });
    
    if (!userMembership) {
      throw new HttpException(
        'Access denied. Owner or admin role required to invite members.',
        HttpStatus.FORBIDDEN
      );
    }

    const workspace = userMembership.workspace;
    const invitedEmails = inviteData.emails;
    const role = inviteData.role.toLowerCase();

    if (!invitedEmails || invitedEmails.length === 0) {
      throw new HttpException('No email addresses provided for invitation.', HttpStatus.BAD_REQUEST);
    }

    // Validate role
    const validRoles = ['owner', 'admin', 'member'] as const;
    if (!validRoles.includes(role as (typeof validRoles)[number])) {
      throw new HttpException(`Invalid role: ${role}. Must be one of: ${validRoles.join(', ')}`, HttpStatus.BAD_REQUEST);
    }
    if (role === 'owner') {
      throw new HttpException('Owner invitations are not supported.', HttpStatus.BAD_REQUEST);
    }
    const normalizedRole: 'admin' | 'member' = role === 'admin' ? 'admin' : 'member';

    const results = await Promise.all(
      invitedEmails.map(async (email) => {
        try {
          // Check if user with this email already exists
          const existingUser = await this.prisma.user.findUnique({
            where: { email },
          });

          // Check if there's already a membership for this user/org or email/org
          const existingMembership = await this.prisma.workspaceMembership.findFirst({
            where: {
              workspaceId,
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

          const invitation = await auth.api.createInvitation({
            body: {
              email,
              organizationId: workspaceId,
              role: normalizedRole,
            },
            headers,
          });
          const invitationToken = await this.prisma.invitation.findUniqueOrThrow({
            where: { id: invitation.id },
            select: { token: true },
          });
          return {
            email,
            status: 'invited',
            invitationId: invitation.id,
            token: invitationToken.token,
          };
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
      workspace: {
        id: workspace.id,
        name: workspace.name,
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
        workspace: {
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
      workspaceId: invitation.workspaceId,
      workspace: invitation.workspace,
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
  async respondToInvitation(
    userId: string,
    invitationId: string,
    action: 'accept' | 'reject',
    headers: Headers,
    token?: string,
  ) {
    const invitationById = await this.prisma.invitation.findUnique({
      where: { id: invitationId },
      include: { workspace: true },
    });
    const invitationByToken = token
      ? await this.prisma.invitation.findUnique({
          where: { token },
          include: { workspace: true },
        })
      : null;

    if (
      invitationById &&
      invitationByToken &&
      invitationById.id !== invitationByToken.id
    ) {
      throw new HttpException(
        'Invitation ID and token refer to different invitations.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const invitation = token
      ? invitationByToken || invitationById
      : invitationById;

    if (!invitation) {
      throw new HttpException('Invitation not found.', HttpStatus.NOT_FOUND);
    }

    if (invitation.status === 'canceled') {
      throw new HttpException('This invitation has been canceled', HttpStatus.BAD_REQUEST);
    }

    if (invitation.expiresAt < new Date()) {
      throw new HttpException('This invitation has expired', HttpStatus.BAD_REQUEST);
    }

    if (invitation.status !== 'pending') {
      throw new HttpException(
        `This invitation has already been ${invitation.status}`,
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
      await auth.api.rejectInvitation({
        body: { invitationId: invitation.id },
        headers,
      });
      return { message: 'Invitation rejected successfully.' };
    } else {
      await auth.api.acceptInvitation({
        body: { invitationId: invitation.id },
        headers,
      });

      return {
        message: 'Invitation accepted successfully.',
        workspace: {
          id: invitation.workspace.id,
          name: invitation.workspace.name,
          role: invitation.role,
        },
      };
    }
  }

  /**
   * Get all members of an workspace
   */
  async getWorkspaceMembers(userId: string, workspaceId: string) {
    // Check if user is a member of the workspace and has access
    const userMembership = await this.prisma.workspaceMembership.findFirst({
      where: {
        userId,
        workspaceId,
      },
    });

    if (!userMembership) {
      throw new HttpException(
        'Access denied. You are not a member of this workspace.',
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

    // Get all members of the workspace
    const members = await this.prisma.workspaceMembership.findMany({
      where: {
        workspaceId,
        status: 'active',
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
      workspaceId: member.workspaceId,
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
   * Update a member's role in an workspace
   */
  async updateMemberRole(
    userId: string, 
    workspaceId: string, 
    memberId: string, 
    newRole: string,
    headers: Headers,
  ) {
    // Check if user is a member of the workspace and has permission to update roles
    const userMembership = await this.prisma.workspaceMembership.findFirst({
      where: {
        userId,
        workspaceId,
        status: 'active',
      },
    });

    if (!userMembership) {
      throw new HttpException(
        'Access denied. You are not an active member of this workspace.',
        HttpStatus.FORBIDDEN
      );
    }

    // Find the member to update
    const memberToUpdate = await this.prisma.workspaceMembership.findUnique({
      where: { id: memberId },
      include: { user: { select: { id: true } } },
    });

    if (!memberToUpdate || memberToUpdate.workspaceId !== workspaceId) {
      throw new HttpException('Member not found in this workspace.', HttpStatus.NOT_FOUND);
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
      const normalizedNewRole = newRole.toLowerCase();
      // Admin can update members only, not owners or other admins
      if (memberToUpdate.role === 'owner' || memberToUpdate.role === 'admin' || memberToUpdate.userId === userId) {
        throw new HttpException(
          'Admins can only change the roles of members, not owners, other admins, or themselves.',
          HttpStatus.FORBIDDEN
        );
      }

      // Admin can only assign member role
      if (normalizedNewRole !== 'member' && normalizedNewRole !== 'editor' && normalizedNewRole !== 'viewer') {
        throw new HttpException(
          'Admins can only assign the member role.',
          HttpStatus.FORBIDDEN
        );
      }
    } else {
      throw new HttpException('Only owners and admins can update member roles.', HttpStatus.FORBIDDEN);
    }

    // Validate the new role
    const normalizedRole = newRole.toLowerCase() === 'admin' ? 'admin' : 'member';
    if (!['owner', 'admin', 'member', 'editor', 'viewer'].includes(newRole.toLowerCase())) {
      throw new HttpException('Invalid role specified.', HttpStatus.BAD_REQUEST);
    }

    await auth.api.updateMemberRole({
      body: {
        memberId,
        role: normalizedRole,
        organizationId: workspaceId,
      },
      headers,
    });
    const updatedMember = await this.prisma.workspaceMembership.findUniqueOrThrow({
      where: { id: memberId },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true, fullName: true },
        },
      },
    });

    return {
      id: updatedMember.id,
      workspaceId: updatedMember.workspaceId,
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
   * Remove a member from an workspace
   */
  async removeMember(userId: string, workspaceId: string, memberId: string, headers: Headers) {
    // Check if user is a member of the workspace and has permission to remove members
    const userMembership = await this.prisma.workspaceMembership.findFirst({
      where: {
        userId,
        workspaceId,
        status: 'active',
      },
    });

    if (!userMembership) {
      throw new HttpException(
        'Access denied. You are not an active member of this workspace.',
        HttpStatus.FORBIDDEN
      );
    }

    // Find the member to remove
    const memberToRemove = await this.prisma.workspaceMembership.findUnique({
      where: { id: memberId },
      include: { user: { select: { id: true } } },
    });

    if (!memberToRemove || memberToRemove.workspaceId !== workspaceId) {
      throw new HttpException('Member not found in this workspace.', HttpStatus.NOT_FOUND);
    }

    // Special case: User is removing themselves (leaving the workspace)
    const isSelfRemoval = memberToRemove.userId === userId;
    
    if (isSelfRemoval) {
      // Owner can't leave without transferring ownership first
      if (memberToRemove.role === 'owner') {
        throw new HttpException(
          'You cannot remove yourself as an owner. Transfer ownership first.',
          HttpStatus.FORBIDDEN
        );
      }
      
      // User is leaving the workspace - allow this regardless of role
      await auth.api.removeMember({
        body: { memberIdOrEmail: memberId, organizationId: workspaceId },
        headers,
      });
      
      return { message: 'You have left the workspace successfully.' };
    }
    
    // Normal case: User is removing someone else
    
    // Check if current user can remove this member based on roles
    if (userMembership.role === 'owner') {
      // Owner can remove anyone except themselves (handled above)
    } else if (userMembership.role === 'admin') {
      // Admin can remove members only, not owners or other admins
      if (memberToRemove.role === 'owner' || memberToRemove.role === 'admin') {
        throw new HttpException(
          'Admins can only remove members, not owners or other admins.',
          HttpStatus.FORBIDDEN
        );
      }
    } else {
      throw new HttpException('Only owners and admins can remove members.', HttpStatus.FORBIDDEN);
    }

    await auth.api.removeMember({
      body: { memberIdOrEmail: memberId, organizationId: workspaceId },
      headers,
    });

    return { message: 'Member removed successfully.' };
  }

  /**
   * Transfer ownership to another member
   */
  async transferOwnership(userId: string, workspaceId: string, newOwnerId: string) {
    // Check if the current user is the owner of the workspace
    const currentOwnerMembership = await this.prisma.workspaceMembership.findFirst({
      where: {
        userId,
        workspaceId,
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

    // Check if the new owner is a member of the workspace
    const newOwnerMembership = await this.prisma.workspaceMembership.findUnique({
      where: { id: newOwnerId },
      include: { user: { select: { id: true, email: true } } },
    });

    if (!newOwnerMembership || newOwnerMembership.workspaceId !== workspaceId) {
      throw new HttpException('The specified member was not found in this workspace.', HttpStatus.NOT_FOUND);
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
      await tx.workspaceMembership.update({
        where: { id: currentOwnerMembership.id },
        data: { role: 'admin' },
      });

      // Promote the new member to owner
      await tx.workspaceMembership.update({
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
    /**
   * Revoke an invitation
   */
  async revokeInvitation(id: string, userId: string, headers: Headers) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { id },
    });

    if (!invitation) {
      throw new NotFoundException(`Invitation with ID ${id} not found`);
    }

    // Verify the user is a member of the workspace with appropriate permissions
    const membership = await this.prisma.workspaceMembership.findFirst({
      where: {
        userId,
        workspaceId: invitation.workspaceId,
        role: { in: ['owner', 'admin'] },
        status: 'active',
      },
    });

    if (!membership) {
      throw new BadRequestException('You do not have permission to revoke this invitation');
    }

    await auth.api.cancelInvitation({
      body: { invitationId: id },
      headers,
    });
    return this.prisma.invitation.findUniqueOrThrow({ where: { id } });
  }

  /**
   * Resend an invitation
   */
  async resendInvitation(id: string, userId: string, headers: Headers) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { id },
    });

    if (!invitation) {
      throw new NotFoundException(`Invitation with ID ${id} not found`);
    }

    // Verify the user is a member of the workspace with appropriate permissions
    const membership = await this.prisma.workspaceMembership.findFirst({
      where: {
        userId,
        workspaceId: invitation.workspaceId,
        role: { in: ['owner', 'admin'] },
        status: 'active',
      },
    });

    if (!membership) {
      throw new BadRequestException('You do not have permission to resend this invitation');
    }

    const resentInvitation = await auth.api.createInvitation({
      body: {
        email: invitation.email,
        organizationId: invitation.workspaceId,
        role: invitation.role === 'admin' ? 'admin' : 'member',
        resend: true,
      },
      headers,
    });
    return this.prisma.invitation.findUniqueOrThrow({
      where: { id: resentInvitation.id },
    });
  }

  /**
   * Validate an email address before invitation
   * Checks if user exists, if they are already a member, and if they have a pending invitation
   */
  async validateEmail(userId: string, workspaceId: string, email: string) {
    // Check if user has permission to invite members
    const userMembership = await this.prisma.workspaceMembership.findFirst({
      where: {
        userId,
        workspaceId,
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

    // Check if the email is already registered to an active member in this workspace
    const existingMembership = await this.prisma.workspaceMembership.findFirst({
      where: {
        workspaceId,
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
        message: 'This user is already a member of this workspace.'
      };
    }

    // Check if there's a pending invitation for this email
    const pendingInvitation = await this.prisma.invitation.findUnique({
      where: {
        email_workspaceId: {
          email,
          workspaceId,
        },
        status: 'pending',
      },
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
