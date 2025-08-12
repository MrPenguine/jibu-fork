import { Controller, Get, Post, Body, Param, Delete, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { InvitationService } from './invitation.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { WorkspaceMemberGuard } from '../../../core/auth/guards/workspace-member.guard';
import { RoleGuard } from '../../../core/auth/guards/role.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    orgId: string;
  };
}

@ApiTags('Invitations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
@Controller('v1/invitations')
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new invitation' })
  @ApiResponse({ status: 201, description: 'The invitation has been successfully created.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Insufficient permissions.' })
  @UseGuards(RoleGuard('ADMIN', 'OWNER'))
  create(@Body() createInvitationDto: CreateInvitationDto, @Req() req: AuthenticatedRequest) {
    const { userId } = req.user;
    return this.invitationService.create(createInvitationDto, userId);
  }

  @Get('organization/:organizationId')
  @ApiOperation({ summary: 'List all invitations for an organization' })
  @ApiResponse({ status: 200, description: 'Return all invitations for the organization.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Insufficient permissions.' })
  @UseGuards(RoleGuard('ADMIN', 'OWNER'))
  findAllByOrganization(@Param('organizationId') organizationId: string, @Req() req: AuthenticatedRequest) {
    const { userId } = req.user;
    return this.invitationService.findAllByOrganization(organizationId, userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an invitation by ID' })
  @ApiResponse({ status: 200, description: 'Return the invitation.' })
  @ApiResponse({ status: 404, description: 'Invitation not found.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Insufficient permissions.' })
  @UseGuards(RoleGuard('ADMIN', 'OWNER'))
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const { userId } = req.user;
    return this.invitationService.findOne(id, userId);
  }

  @Get('token/:token')
  @ApiOperation({ summary: 'Get an invitation by token (public endpoint)' })
  @ApiResponse({ status: 200, description: 'Return the invitation.' })
  @ApiResponse({ status: 404, description: 'Invitation not found.' })
  findByToken(@Param('token') token: string) {
    return this.invitationService.findByToken(token);
  }

  @Post(':id/revoke')
  @ApiOperation({ summary: 'Revoke an invitation' })
  @ApiResponse({ status: 200, description: 'The invitation has been successfully revoked.' })
  @ApiResponse({ status: 404, description: 'Invitation not found.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Insufficient permissions.' })
  @UseGuards(RoleGuard('ADMIN', 'OWNER'))
  revoke(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const { userId } = req.user;
    return this.invitationService.revoke(id, userId);
  }

  @Post(':id/resend')
  @ApiOperation({ summary: 'Resend an invitation' })
  @ApiResponse({ status: 200, description: 'The invitation has been successfully resent.' })
  @ApiResponse({ status: 404, description: 'Invitation not found.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Insufficient permissions.' })
  @UseGuards(RoleGuard('ADMIN', 'OWNER'))
  resend(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const { userId } = req.user;
    return this.invitationService.resend(id, userId);
  }
}
