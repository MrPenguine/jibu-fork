import { Controller, Get, Post, Body, Param, Delete, Put, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { FolderService } from './folder.service.js';
import { CreateFolderDto, UpdateFolderDto } from './dto/index';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { OrgRoleGuard } from '../../../core/auth/guards/org-role.guard';
import { OrgResourceGuard } from '../../../core/auth/guards/org-resource.guard';
import { OrgResource } from '../../../core/auth/decorators/org-resource.decorator';
import { WorkspaceMemberGuard } from '../../../core/auth/guards/workspace-member.guard';
import { RoleGuard, Roles } from '../../../core/auth/guards/role.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    orgId: string;
  };
}

@ApiTags('Folders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
@Controller('v1/folders')
export class FolderController {
  constructor(private readonly folderService: FolderService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new folder' })
  @ApiResponse({ status: 201, description: 'The folder has been successfully created.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Insufficient permissions.' })
  @UseGuards(RoleGuard('ADMIN', 'OWNER'))
  create(@Body() createFolderDto: CreateFolderDto, @Req() req: AuthenticatedRequest) {
    const { orgId, userId } = req.user;
    if (!orgId) {
      throw new BadRequestException('Organization ID must be provided.');
    }
    return this.folderService.create(createFolderDto, orgId, userId);
  }

  @Get()
  @ApiOperation({ summary: 'List all folders for the organization' })
  @ApiResponse({ status: 200, description: 'Return all folders.' })
  findAll(@Req() req: AuthenticatedRequest) {
    const { orgId, userId } = req.user;
    if (!orgId) {
      throw new BadRequestException('Organization ID must be provided.');
    }
    return this.folderService.findAll(orgId, userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a folder by ID' })
  @ApiResponse({ status: 200, description: 'Return the folder.' })
  @ApiResponse({ status: 404, description: 'Folder not found.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Folder does not belong to your organization.' })
  @UseGuards(OrgResourceGuard)
  @OrgResource('folder')
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const { orgId, userId } = req.user;
    if (!orgId) {
      throw new BadRequestException('Organization ID must be provided.');
    }
    return this.folderService.findOne(id, orgId, userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a folder' })
  @ApiResponse({ status: 200, description: 'The folder has been successfully updated.' })
  @ApiResponse({ status: 404, description: 'Folder not found.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Folder does not belong to your organization.' })
  @UseGuards(OrgResourceGuard)
  @OrgResource('folder')
  update(@Param('id') id: string, @Body() updateFolderDto: UpdateFolderDto, @Req() req: AuthenticatedRequest) {
    const { orgId, userId } = req.user;
    if (!orgId) {
      throw new BadRequestException('Organization ID must be provided.');
    }
    return this.folderService.update(id, updateFolderDto, orgId, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a folder' })
  @ApiResponse({ status: 200, description: 'The folder has been successfully deleted.' })
  @ApiResponse({ status: 404, description: 'Folder not found.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Folder does not belong to your organization.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Insufficient permissions.' })
  @UseGuards(OrgResourceGuard, RoleGuard('ADMIN', 'OWNER'))
  @OrgResource('folder')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const { orgId, userId } = req.user;
    if (!orgId) {
      throw new BadRequestException('Organization ID must be provided.');
    }
    return this.folderService.remove(id, orgId, userId);
  }
}
