import { Injectable, Logger, NotFoundException, Inject, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { IStorageService } from '../../../integrations/storage/interfaces/storage.interface';
import { FileResponseDto } from './dto/file-response.dto';
import { ListFilesDto } from './dto/list-files.dto';
import { plainToInstance } from 'class-transformer';

// Simple ID generator function
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
};

// Use a simple sanitization function
const sanitizeFilename = (filename: string): string => {
  // Remove invalid characters for filenames
  return filename.replace(/[/\\?%*:|"<>]/g, '_');
};

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(IStorageService) private readonly storageService: IStorageService,
  ) {}

  async uploadAndCreateFileMetadata(
    orgId: string,
    userId: string,
    file: MulterFile,
  ): Promise<FileResponseDto> {
    const sanitizedName = sanitizeFilename(file.originalname);
    const fileId = generateId();
    const storageKey = `${fileId}/${sanitizedName}`;

    this.logger.log(`Uploading file ${sanitizedName} for org ${orgId} by user ${userId}`);

    try {
      // First check if organization exists
      const organization = await this.prisma.organization.findUnique({
        where: { id: orgId },
      });

      if (!organization) {
        this.logger.warn(`Organization with ID ${orgId} not found. Need to create it first.`);
        
        // Check if user exists
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
        });
        
        if (!user) {
          this.logger.warn(`User with ID ${userId} not found. Creating user first.`);
          
          // Create user if not exists (basic info)
          await this.prisma.user.create({
            data: {
              id: userId,
              email: `${userId}@example.com`, // Placeholder email
            },
          });
        }
        
        // Create organization
        await this.prisma.organization.create({
          data: {
            id: orgId,
            name: `Organization ${orgId.substring(0, 8)}`,
            memberships: {
              create: {
                userId: userId,
                role: 'admin',
              },
            },
          },
        });
        
        this.logger.log(`Created organization ${orgId} and linked to user ${userId}`);
      }

      // Upload to storage service
      const uploadResult = await this.storageService.upload(
        storageKey,
        file.buffer,
        file.mimetype,
        orgId,
      );

      // Save metadata to database
      const fileRecord = await this.prisma.file.create({
        data: {
          name: sanitizedName,
          storageProvider: 's3',
          storageKey: uploadResult.key,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          organizationId: orgId,
          userId: userId,
        },
      });

      this.logger.log(`File ${fileRecord.id} uploaded and metadata saved`);
      return plainToInstance(FileResponseDto, fileRecord);
    } catch (error) {
      this.logger.error(`File upload failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findFilesByOrg(
    orgId: string,
    paginationOptions?: { page?: number; pageSize?: number },
  ): Promise<ListFilesDto> {
    const page = paginationOptions?.page ?? 1;
    const pageSize = paginationOptions?.pageSize ?? 10;
    const skip = (page - 1) * pageSize;

    try {
      const [files, total] = await Promise.all([
        this.prisma.file.findMany({
          where: { organizationId: orgId },
          take: pageSize,
          skip,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              }
            }
          }
        }),
        this.prisma.file.count({ where: { organizationId: orgId } }),
      ]);

      return plainToInstance(ListFilesDto, {
        data: files.map(file => {
          const fileDto = plainToInstance(FileResponseDto, file);
          // Add uploader info if available
          if (file.user) {
            fileDto.uploader = {
              id: file.user.id,
              firstName: file.user.firstName,
              lastName: file.user.lastName,
              email: file.user.email,
            };
          }
          return fileDto;
        }),
        total,
        page,
        pageSize,
      });
    } catch (error) {
      this.logger.error(`Error finding files for org ${orgId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findFileById(fileId: string, orgId: string): Promise<FileResponseDto> {
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, organizationId: orgId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          }
        }
      }
    });

    if (!file) {
      throw new NotFoundException(`File with ID ${fileId} not found`);
    }

    const fileDto = plainToInstance(FileResponseDto, file);
    
    // Add uploader info if available
    if (file.user) {
      fileDto.uploader = {
        id: file.user.id,
        firstName: file.user.firstName,
        lastName: file.user.lastName,
        email: file.user.email,
      };
    }
    
    return fileDto;
  }

  async getFileMetadataForDownload(
    fileId: string,
    orgId: string,
  ): Promise<{ storageKey: string; name: string }> {
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, organizationId: orgId },
      select: { storageKey: true, name: true },
    });

    if (!file) {
      throw new NotFoundException(`File with ID ${fileId} not found`);
    }

    return file;
  }

  async getDownloadUrl(fileId: string, orgId: string): Promise<string> {
    const metadata = await this.getFileMetadataForDownload(fileId, orgId);
    return this.storageService.getSignedDownloadUrl(metadata.storageKey, orgId);
  }

  async deleteFile(fileId: string, orgId: string, userId: string, isAdmin = false): Promise<void> {
    // First get the file to check ownership
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, organizationId: orgId },
    });
    
    if (!file) {
      throw new NotFoundException(`File with ID ${fileId} not found`);
    }
    
    // Only allow deletion if the user is the uploader or has admin permissions
    if (!isAdmin && file.userId !== userId) {
      throw new BadRequestException('You do not have permission to delete this file');
    }
    
    try {
      // Delete from storage
      await this.storageService.delete(file.storageKey, orgId);
      
      // Delete metadata from database
      await this.prisma.file.delete({
        where: { id: fileId },
      });
      
      this.logger.log(`File ${fileId} deleted for org ${orgId} by user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to delete file ${fileId}: ${error.message}`, error.stack);
      throw error;
    }
  }
}