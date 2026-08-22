import { Controller, Get, Post, Body, Param, Delete, Put, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { FolderService } from './folder.service';
import { CreateFolderDto, UpdateFolderDto } from './dto/index';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { OrganizationGuard } from '../../../core/auth/guards/organization.guard';
import { OrganizationRoleGuard } from '../../../core/auth/guards/organization-role.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    workspaceId: string;
  };
}

@ApiTags('Folders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationGuard)
@Controller('v1/folders')
export class FolderController {
  constructor(private readonly folderService: FolderService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new folder' })
  @ApiResponse({ status: 201, description: 'The folder has been successfully created.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Insufficient permissions.' })
  @UseGuards(OrganizationRoleGuard('ADMIN', 'OWNER'))
  create(@Body() createFolderDto: CreateFolderDto, @Req() req: AuthenticatedRequest) {
    const { workspaceId, userId } = req.user;
    if (!workspaceId) {
      throw new BadRequestException('Workspace ID must be provided.');
    }
    return this.folderService.create(createFolderDto, workspaceId, userId);
  }

  @Get()
  @ApiOperation({ summary: 'List all folders for the organization' })
  @ApiResponse({ status: 200, description: 'Return all folders.' })
  findAll(@Req() req: AuthenticatedRequest) {
    const { workspaceId, userId } = req.user;
    if (!workspaceId) {
      throw new BadRequestException('Workspace ID must be provided.');
    }
    return this.folderService.findAll(workspaceId, userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a folder by ID' })
  @ApiResponse({ status: 200, description: 'Return the folder.' })
  @ApiResponse({ status: 404, description: 'Folder not found.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Folder does not belong to your workspace.' })
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const { workspaceId, userId } = req.user;
    if (!workspaceId) {
      throw new BadRequestException('Workspace ID must be provided.');
    }
    return this.folderService.findOne(id, workspaceId, userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a folder' })
  @ApiResponse({ status: 200, description: 'The folder has been successfully updated.' })
  @ApiResponse({ status: 404, description: 'Folder not found.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Folder does not belong to your workspace.' })
  update(@Param('id') id: string, @Body() updateFolderDto: UpdateFolderDto, @Req() req: AuthenticatedRequest) {
    const { workspaceId, userId } = req.user;
    if (!workspaceId) {
      throw new BadRequestException('Workspace ID must be provided.');
    }
    return this.folderService.update(id, updateFolderDto, workspaceId, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a folder' })
  @ApiResponse({ status: 200, description: 'The folder has been successfully deleted.' })
  @ApiResponse({ status: 404, description: 'Folder not found.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Folder does not belong to your workspace.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Insufficient permissions.' })
  @UseGuards(OrganizationRoleGuard('ADMIN', 'OWNER'))
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const { workspaceId, userId } = req.user;
    if (!workspaceId) {
      throw new BadRequestException('Workspace ID must be provided.');
    }
    return this.folderService.remove(id, workspaceId, userId);
  }
}
