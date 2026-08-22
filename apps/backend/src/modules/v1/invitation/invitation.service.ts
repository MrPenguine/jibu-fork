import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { Cron, CronExpression } from '@nestjs/schedule';
import { auth } from '../../../core/auth/auth';

@Injectable()
export class InvitationService {
  private readonly logger = new Logger(InvitationService.name);

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Create a new invitation
   */
  async create(
    createInvitationDto: CreateInvitationDto,
    invitedById: string,
    headers: Headers,
  ) {
    this.logger.log(`Creating invitation for ${createInvitationDto.email} by user ${invitedById}`);
    
    const membership = await this.prisma.workspaceMembership.findFirst({
      where: {
        userId: invitedById,
        workspaceId: createInvitationDto.workspaceId,
        role: {
          in: ['admin', 'owner'],
        },
        status: 'active',
      },
    });

    if (!membership) {
      throw new BadRequestException('You do not have permission to invite members to this workspace');
    }

    const existingInvitation = await this.prisma.invitation.findFirst({
      where: {
        email: createInvitationDto.email,
        workspaceId: createInvitationDto.workspaceId,
        status: 'pending',
      },
    });

    if (existingInvitation) {
      throw new BadRequestException('An invitation has already been sent to this email');
    }

    const invitation = await auth.api.createInvitation({
      body: {
        email: createInvitationDto.email,
        organizationId: createInvitationDto.workspaceId,
        role: createInvitationDto.role === 'admin' ? 'admin' : 'member',
      },
      headers,
    });
    if (createInvitationDto.message) {
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { message: createInvitationDto.message },
      });
    }
    return this.prisma.invitation.findUniqueOrThrow({ where: { id: invitation.id } });
  }

  /**
   * Get all invitations for a workspace
   */
  async findAllByWorkspace(workspaceId: string, userId: string) {
    const membership = await this.prisma.workspaceMembership.findFirst({
      where: {
        userId,
        workspaceId,
        role: {
          in: ['admin', 'owner'],
        },
        status: 'active',
      },
    });

    if (!membership) {
      throw new BadRequestException('You do not have permission to view invitations for this workspace');
    }

    return this.prisma.invitation.findMany({
      where: {
        workspaceId,
      },
      include: {
        invitedBy: {
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
        createdAt: 'desc',
      },
    });
  }

  /**
   * Get an invitation by ID
   */
  async findOne(id: string, userId: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { id },
      include: {
        workspace: true,
        invitedBy: {
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
    });

    if (!invitation) {
      throw new NotFoundException(`Invitation with ID ${id} not found`);
    }

    const membership = await this.prisma.workspaceMembership.findFirst({
      where: {
        userId,
        workspaceId: invitation.workspaceId,
        role: {
          in: ['admin', 'owner'],
        },
        status: 'active',
      },
    });

    if (!membership) {
      throw new BadRequestException('You do not have permission to view this invitation');
    }

    return invitation;
  }

  /**
   * Get an invitation by token (public endpoint)
   */
  async findByToken(token: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      include: {
        workspace: true,
        invitedBy: {
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
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status === 'canceled' || invitation.expiresAt < new Date()) {
      if (invitation.status !== 'canceled') {
        await this.prisma.invitation.update({
          where: { id: invitation.id },
          data: { status: 'canceled' },
        });
      }
      throw new BadRequestException('This invitation has expired');
    }

    return invitation;
  }

  /**
   * Revoke an invitation
   */
  async revoke(id: string, userId: string, headers: Headers) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { id },
    });

    if (!invitation) {
      throw new NotFoundException(`Invitation with ID ${id} not found`);
    }

    const membership = await this.prisma.workspaceMembership.findFirst({
      where: {
        userId,
        workspaceId: invitation.workspaceId,
        role: {
          in: ['admin', 'owner'],
        },
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
  async resend(id: string, userId: string, headers: Headers) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { id },
    });

    if (!invitation) {
      throw new NotFoundException(`Invitation with ID ${id} not found`);
    }

    const membership = await this.prisma.workspaceMembership.findFirst({
      where: {
        userId,
        workspaceId: invitation.workspaceId,
        role: {
          in: ['admin', 'owner'],
        },
        status: 'active',
      },
    });

    if (!membership) {
      throw new BadRequestException('You do not have permission to resend this invitation');
    }

    await auth.api.createInvitation({
      body: {
        email: invitation.email,
        organizationId: invitation.workspaceId,
        role: invitation.role === 'admin' ? 'admin' : 'member',
        resend: true,
      },
      headers,
    });
    return this.prisma.invitation.findUniqueOrThrow({ where: { id } });
  }

  /**
   * Expire old invitations (to be called by a scheduled job)
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async expireOldInvitations() {
    this.logger.log('Running job to expire old invitations');
    
    const now = new Date();
    
    const result = await this.prisma.invitation.updateMany({
      where: {
        status: 'pending',
        expiresAt: {
          lt: now,
        },
      },
      data: {
        status: 'canceled',
      },
    });
    
    this.logger.log(`Expired ${result.count} invitations`);
    
    return result;
  }
}
