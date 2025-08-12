import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { add } from 'date-fns';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class InvitationService {
  private readonly logger = new Logger(InvitationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Create a new invitation
   */
  async create(createInvitationDto: CreateInvitationDto, invitedById: string) {
    this.logger.log(`Creating invitation for ${createInvitationDto.email} by user ${invitedById}`);
    
    // Verify the user is a member of the organization with appropriate permissions
    const membership = await this.prisma.organizationMembership.findFirst({
      where: {
        userId: invitedById,
        organizationId: createInvitationDto.organizationId,
        role: {
          in: ['ADMIN', 'OWNER'],
        },
        status: 'ACTIVE',
      },
    });

    if (!membership) {
      throw new BadRequestException('You do not have permission to invite members to this organization');
    }

    // Check if an active invitation already exists for this email and organization
    const existingInvitation = await this.prisma.invitation.findFirst({
      where: {
        email: createInvitationDto.email,
        organizationId: createInvitationDto.organizationId,
        status: 'PENDING',
      },
    });

    if (existingInvitation) {
      throw new BadRequestException('An invitation has already been sent to this email');
    }

    // Generate a secure random token
    const token = randomBytes(32).toString('hex');
    
    // Set expiration date (default: 7 days)
    const expirationDays = this.configService.get<number>('INVITATION_EXPIRY_DAYS', 7);
    const expiresAt = add(new Date(), { days: expirationDays });

    // Create the invitation
    return this.prisma.invitation.create({
      data: {
        email: createInvitationDto.email,
        organizationId: createInvitationDto.organizationId,
        role: createInvitationDto.role,
        token,
        invitedById,
        message: createInvitationDto.message,
        expiresAt,
      },
    });
  }

  /**
   * Get all invitations for an organization
   */
  async findAllByOrganization(organizationId: string, userId: string) {
    // Verify the user is a member of the organization with appropriate permissions
    const membership = await this.prisma.organizationMembership.findFirst({
      where: {
        userId,
        organizationId,
        role: {
          in: ['ADMIN', 'OWNER'],
        },
        status: 'ACTIVE',
      },
    });

    if (!membership) {
      throw new BadRequestException('You do not have permission to view invitations for this organization');
    }

    return this.prisma.invitation.findMany({
      where: {
        organizationId,
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
        organization: true,
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

    // Verify the user is a member of the organization with appropriate permissions
    const membership = await this.prisma.organizationMembership.findFirst({
      where: {
        userId,
        organizationId: invitation.organizationId,
        role: {
          in: ['ADMIN', 'OWNER'],
        },
        status: 'ACTIVE',
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
        organization: true,
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

    // Check if the invitation has expired
    if (invitation.status === 'EXPIRED' || invitation.expiresAt < new Date()) {
      // Update the status to EXPIRED if it's not already
      if (invitation.status !== 'EXPIRED') {
        await this.prisma.invitation.update({
          where: { id: invitation.id },
          data: { status: 'EXPIRED' },
        });
      }
      throw new BadRequestException('This invitation has expired');
    }

    // Check if the invitation has been revoked
    if (invitation.status === 'REVOKED') {
      throw new BadRequestException('This invitation has been revoked');
    }

    return invitation;
  }

  /**
   * Revoke an invitation
   */
  async revoke(id: string, userId: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { id },
    });

    if (!invitation) {
      throw new NotFoundException(`Invitation with ID ${id} not found`);
    }

    // Verify the user is a member of the organization with appropriate permissions
    const membership = await this.prisma.organizationMembership.findFirst({
      where: {
        userId,
        organizationId: invitation.organizationId,
        role: {
          in: ['ADMIN', 'OWNER'],
        },
        status: 'ACTIVE',
      },
    });

    if (!membership) {
      throw new BadRequestException('You do not have permission to revoke this invitation');
    }

    return this.prisma.invitation.update({
      where: { id },
      data: { status: 'REVOKED' },
    });
  }

  /**
   * Resend an invitation
   */
  async resend(id: string, userId: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { id },
    });

    if (!invitation) {
      throw new NotFoundException(`Invitation with ID ${id} not found`);
    }

    // Verify the user is a member of the organization with appropriate permissions
    const membership = await this.prisma.organizationMembership.findFirst({
      where: {
        userId,
        organizationId: invitation.organizationId,
        role: {
          in: ['ADMIN', 'OWNER'],
        },
        status: 'ACTIVE',
      },
    });

    if (!membership) {
      throw new BadRequestException('You do not have permission to resend this invitation');
    }

    // Generate a new token
    const token = randomBytes(32).toString('hex');
    
    // Set new expiration date
    const expirationDays = this.configService.get<number>('INVITATION_EXPIRY_DAYS', 7);
    const expiresAt = add(new Date(), { days: expirationDays });

    // Update the invitation
    return this.prisma.invitation.update({
      where: { id },
      data: {
        token,
        status: 'PENDING',
        expiresAt,
        updatedAt: new Date(),
      },
    });
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
        status: 'PENDING',
        expiresAt: {
          lt: now,
        },
      },
      data: {
        status: 'EXPIRED',
      },
    });
    
    this.logger.log(`Expired ${result.count} invitations`);
    
    return result;
  }
}
