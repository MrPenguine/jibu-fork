import { Controller, Get, Post, Put, Delete, UseGuards, Request, Body, Param } from '@nestjs/common';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { OrganizationService } from './organization.service';
import { CreateOrganizationDto, UpdateOrganizationDto } from './dto/organization.dto';
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
} 