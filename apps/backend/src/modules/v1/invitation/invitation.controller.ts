import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { InvitationService } from './invitation.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { OrganizationGuard } from '../../../core/auth/guards/organization.guard';
import { OrganizationRoleGuard } from '../../../core/auth/guards/organization-role.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { requestHeaders } from '../../../core/auth/request-headers';
import { Public } from '../../../core/auth/decorators/public.decorator';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    userId: string;
    workspaceId: string;
  };
}

@ApiTags('Invitations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationGuard)
@Controller('v1/invitations')
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new invitation' })
  @ApiResponse({ status: 201, description: 'The invitation has been successfully created.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Insufficient permissions.' })
  @UseGuards(OrganizationRoleGuard('ADMIN', 'OWNER'))
  create(@Body() createInvitationDto: CreateInvitationDto, @Req() req: AuthenticatedRequest) {
    const userId = req.user.id;
    return this.invitationService.create(createInvitationDto, userId, requestHeaders(req));
  }

  @Get('workspace/:workspaceId')
  @ApiOperation({ summary: 'List all invitations for a workspace' })
  @ApiResponse({ status: 200, description: 'Return all invitations for the workspace.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Insufficient permissions.' })
  @UseGuards(OrganizationRoleGuard('ADMIN', 'OWNER'))
  findAllByWorkspace(@Param('workspaceId') workspaceId: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user.id;
    return this.invitationService.findAllByWorkspace(workspaceId, userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an invitation by ID' })
  @ApiResponse({ status: 200, description: 'Return the invitation.' })
  @ApiResponse({ status: 404, description: 'Invitation not found.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Insufficient permissions.' })
  @UseGuards(OrganizationRoleGuard('ADMIN', 'OWNER'))
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user.id;
    return this.invitationService.findOne(id, userId);
  }

  @Get('token/:token')
  @Public()
  @ApiOperation({ summary: 'Get an invitation by token (public endpoint)' })
  @ApiResponse({ status: 200, description: 'Return the invitation.' })
  @ApiResponse({ status: 404, description: 'Invitation not found.' })
  findByToken(@Param('token') token: string) {
    return this.invitationService.findByToken(token);
  }

  @Get('public/:identifier')
  @Public()
  @ApiOperation({ summary: 'Get an invitation by ID or token (public endpoint)' })
  findPublic(@Param('identifier') identifier: string) {
    return this.invitationService.findPublic(identifier);
  }

  @Post(':id/revoke')
  @ApiOperation({ summary: 'Revoke an invitation' })
  @ApiResponse({ status: 200, description: 'The invitation has been successfully revoked.' })
  @ApiResponse({ status: 404, description: 'Invitation not found.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Insufficient permissions.' })
  @UseGuards(OrganizationRoleGuard('ADMIN', 'OWNER'))
  revoke(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user.id;
    return this.invitationService.revoke(id, userId, requestHeaders(req));
  }

  @Post(':id/resend')
  @ApiOperation({ summary: 'Resend an invitation' })
  @ApiResponse({ status: 200, description: 'The invitation has been successfully resent.' })
  @ApiResponse({ status: 404, description: 'Invitation not found.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Insufficient permissions.' })
  @UseGuards(OrganizationRoleGuard('ADMIN', 'OWNER'))
  resend(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user.id;
    return this.invitationService.resend(id, userId, requestHeaders(req));
  }
}
