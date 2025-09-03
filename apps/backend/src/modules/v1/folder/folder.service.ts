import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CreateFolderDto, UpdateFolderDto } from './dto/index';
import { Logger } from '@nestjs/common';

@Injectable()
export class FolderService {
  private readonly logger = new Logger(FolderService.name);
  
  constructor(private prisma: PrismaService) {}

  async create(createFolderDto: CreateFolderDto, workspaceId: string, userId: string) {
    this.logger.log(`Creating folder for user ${userId} in workspace ${workspaceId}`);
    
    await this.verifyWorkspaceMembership(userId, workspaceId);
    
    return this.prisma.folder.create({
      data: {
        ...createFolderDto,
        workspaceId,
      },
    });
  }
  
  private async verifyWorkspaceMembership(userId: string, workspaceId: string): Promise<void> {
    const membership = await this.prisma.workspaceMembership.findFirst({
      where: {
        userId,
        workspaceId,
        status: 'active',
      },
    });
    
    if (!membership) {
      this.logger.warn(`User ${userId} attempted to access workspace ${workspaceId} without membership`);
      throw new ForbiddenException('You are not a member of this workspace');
    }
  }

  async findAll(workspaceId: string, userId: string) {
    this.logger.log(`Finding all folders for user ${userId} in workspace ${workspaceId}`);
    
    await this.verifyWorkspaceMembership(userId, workspaceId);
    
    return this.prisma.folder.findMany({
      where: { workspaceId },
    });
  }

  async findOne(id: string, workspaceId: string, userId: string) {
    this.logger.log(`Finding folder ${id} for user ${userId} in workspace ${workspaceId}`);
    
    await this.verifyWorkspaceMembership(userId, workspaceId);
    
    const folder = await this.prisma.folder.findFirst({
      where: { id, workspaceId },
    });
    
    if (!folder) {
      throw new NotFoundException(`Folder with ID "${id}" not found`);
    }
    
    return folder;
  }

  async update(id: string, updateFolderDto: UpdateFolderDto, workspaceId: string, userId: string) {
    this.logger.log(`Updating folder ${id} for user ${userId} in workspace ${workspaceId}`);
    
    await this.findOne(id, workspaceId, userId);
    
    return this.prisma.folder.update({
      where: { id },
      data: updateFolderDto,
    });
  }

  async remove(id: string, workspaceId: string, userId: string) {
    this.logger.log(`Removing folder ${id} for user ${userId} in workspace ${workspaceId}`);
    
    await this.findOne(id, workspaceId, userId);
    
    return this.prisma.folder.delete({ where: { id } });
  }
}
