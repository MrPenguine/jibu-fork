import { Controller, Get, Post, Put, Patch, Delete, UseGuards, Request, Body, Param } from '@nestjs/common';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { OrganizationService } from './organization.service';
import { CreateOrganizationDto, UpdateOrganizationDto, InviteMembersDto, RespondToInvitationDto, UpdateMemberRoleDto } from './dto/organization.dto';
import { OrgRoleGuard } from '../../../core/auth/guards/org-role.guard';
import { Roles } from '../../../core/auth/decorators/roles.decorator';

@Controller('organizations')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  /**
   * Get the organizations that the current user is a member of
   */
  @UseGuards(JwtAuthGuard)
  @Get()
  async getUserOrganizations(@Request() req: any) {
    return this.organizationService.getUserOrganizations(req.user.id);
  }
  
  /**
   * Get a specific organization by ID
   */
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getOrganization(@Request() req: any, @Param('id') id: string) {
    return this.organizationService.getOrganization(req.user.id, id);
  }
  
  /**
   * Create a new organization and make the current user the owner
   */
  @UseGuards(JwtAuthGuard)
  @Post()
  async createOrganization(@Request() req: any, @Body() createOrgDto: CreateOrganizationDto) {
    return this.organizationService.createOrganization(req.user.id, createOrgDto.name);
  }
  
  /**
   * Update an organization - requires owner or admin role
   */
  @UseGuards(JwtAuthGuard, OrgRoleGuard)
  @Roles('admin', 'owner')
  @Put(':id')
  async updateOrganization(
    @Request() req: any, 
    @Param('id') id: string, 
    @Body() updateOrgDto: UpdateOrganizationDto
  ) {
    return this.organizationService.updateOrganization(req.user.id, id, updateOrgDto);
  }
  
  /**
   * Delete an organization - requires owner role
   */
  @UseGuards(JwtAuthGuard, OrgRoleGuard)
  @Roles('owner')
  @Delete(':id')
  async deleteOrganization(@Request() req: any, @Param('id') id: string) {
    return this.organizationService.deleteOrganization(req.user.id, id);
  }

  /**
   * Invite members to an organization - requires owner or admin role
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/invitations')
  async inviteMembers(
    @Request() req: any, 
    @Param('id') id: string, 
    @Body() inviteDto: InviteMembersDto
  ) {
    return this.organizationService.inviteMembers(req.user.id, id, inviteDto);
  }

  /**
   * Get all members of an organization
   */
  @UseGuards(JwtAuthGuard)
  @Get(':id/members')
  async getOrganizationMembers(@Request() req: any, @Param('id') id: string) {
    return this.organizationService.getOrganizationMembers(req.user.id, id);
  }
  
  /**
   * Update a member's role - requires owner or admin role with proper permissions
   */
  @UseGuards(JwtAuthGuard)
  @Patch(':id/members/:memberId')
  async updateMemberRole(
    @Request() req: any, 
    @Param('id') orgId: string, 
    @Param('memberId') memberId: string,
    @Body() updateDto: UpdateMemberRoleDto
  ) {
    return this.organizationService.updateMemberRole(req.user.id, orgId, memberId, updateDto.role);
  }
  
  /**
   * Remove a member from an organization - requires owner or admin role with proper permissions
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':id/members/:memberId')
  async removeMember(
    @Request() req: any, 
    @Param('id') orgId: string, 
    @Param('memberId') memberId: string
  ) {
    return this.organizationService.removeMember(req.user.id, orgId, memberId);
  }
}

// Create a separate controller for invitation management
@Controller('invitations')
export class InvitationController {
  constructor(private readonly organizationService: OrganizationService) {}
  
  /**
   * Get all pending invitations for the current user
   */
  @UseGuards(JwtAuthGuard)
  @Get()
  async getUserInvitations(@Request() req: any) {
    return this.organizationService.getUserInvitations(req.user.email);
  }
  
  /**
   * Accept or reject an invitation
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/respond')
  async respondToInvitation(
    @Request() req: any, 
    @Param('id') id: string, 
    @Body() responseDto: RespondToInvitationDto
  ) {
    return this.organizationService.respondToInvitation(req.user.id, id, responseDto.action);
  }
} 