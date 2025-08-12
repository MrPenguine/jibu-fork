import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CreateFolderDto, UpdateFolderDto } from './dto/index';
import { Logger } from '@nestjs/common';

@Injectable()
export class FolderService {
  private readonly logger = new Logger(FolderService.name);
  
  constructor(private prisma: PrismaService) {}

  async create(createFolderDto: CreateFolderDto, organizationId: string, userId: string) {
    this.logger.log(`Creating folder for user ${userId} in organization ${organizationId}`);
    
    // Verify user is a member of the organization
    await this.verifyOrganizationMembership(userId, organizationId);
    
    return this.prisma.folder.create({
      data: {
        ...createFolderDto,
        organizationId,
      },
    });
  }
  
  /**
   * Verifies that a user is a member of the specified organization
   * @param userId The ID of the user
   * @param organizationId The ID of the organization
   * @throws ForbiddenException if the user is not a member of the organization
   */
  private async verifyOrganizationMembership(userId: string, organizationId: string): Promise<void> {
    const membership = await this.prisma.organizationMembership.findFirst({
      where: {
        userId,
        organizationId,
        status: 'active',
      },
    });
    
    if (!membership) {
      this.logger.warn(`User ${userId} attempted to access organization ${organizationId} without membership`);
      throw new ForbiddenException('You are not a member of this organization');
    }
  }

  async findAll(organizationId: string, userId: string) {
    this.logger.log(`Finding all folders for user ${userId} in organization ${organizationId}`);
    
    // Verify user is a member of the organization
    await this.verifyOrganizationMembership(userId, organizationId);
    
    return this.prisma.folder.findMany({
      where: { organizationId },
    });
  }

  async findOne(id: string, organizationId: string, userId: string) {
    this.logger.log(`Finding folder ${id} for user ${userId} in organization ${organizationId}`);
    
    // Verify user is a member of the organization
    await this.verifyOrganizationMembership(userId, organizationId);
    
    const folder = await this.prisma.folder.findFirst({
      where: { id, organizationId },
    });
    
    if (!folder) {
      throw new NotFoundException(`Folder with ID "${id}" not found`);
    }
    
    return folder;
  }

  async update(id: string, updateFolderDto: UpdateFolderDto, organizationId: string, userId: string) {
    this.logger.log(`Updating folder ${id} for user ${userId} in organization ${organizationId}`);
    
    // Verify user is a member of the organization and folder exists
    await this.findOne(id, organizationId, userId);
    
    return this.prisma.folder.update({
      where: { id },
      data: updateFolderDto,
    });
  }

  async remove(id: string, organizationId: string, userId: string) {
    this.logger.log(`Removing folder ${id} for user ${userId} in organization ${organizationId}`);
    
    // Verify user is a member of the organization and folder exists
    await this.findOne(id, organizationId, userId);
    
    return this.prisma.folder.delete({ where: { id } });
  }
}
