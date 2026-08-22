import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
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
    return this.findPublic(token, true);
  }

  async findPublic(identifier: string, tokenOnly = false) {
    const invitation = await this.prisma.invitation.findFirst({
      where: tokenOnly
        ? { token: identifier }
        : { OR: [{ id: identifier }, { token: identifier }] },
      select: {
        id: true,
        email: true,
        workspaceId: true,
        role: true,
        status: true,
        expiresAt: true,
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status === 'canceled') {
      throw new BadRequestException('This invitation has been canceled');
    }
    if (invitation.expiresAt < new Date()) {
      throw new BadRequestException('This invitation has expired');
    }
    if (invitation.status !== 'pending') {
      throw new BadRequestException(`This invitation has already been ${invitation.status}`);
    }

    const [localPart, domain] = invitation.email.split('@');
    const maskedEmail =
      localPart && domain
        ? `${localPart[0] || '*'}***@${domain}`
        : '***';

    return {
      id: invitation.id,
      workspace: invitation.workspace,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      email: maskedEmail,
    };
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

}
