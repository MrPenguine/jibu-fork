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
    workspaceId: string,
    userId: string,
    file: MulterFile,
  ): Promise<FileResponseDto> {
    const sanitizedName = sanitizeFilename(file.originalname);
    const fileId = generateId();
    const storageKey = `${fileId}/${sanitizedName}`;

    let cleanUserId = userId;
    if (userId?.includes(',')) {
      cleanUserId = userId.split(',')[0];
      this.logger.warn(`Received comma-separated userId: ${userId}, using first value: ${cleanUserId}`);
    } else if (Array.isArray(userId)) {
      cleanUserId = userId[0];
      this.logger.warn(`Received array userId: ${userId}, using first value: ${cleanUserId}`);
    }
    
    if (!cleanUserId || typeof cleanUserId !== 'string') {
      this.logger.error(`Invalid userId provided: ${userId}. Using default placeholder.`);
      cleanUserId = 'unknown-user';
    }

    this.logger.log(`Uploading file ${sanitizedName} for workspace ${workspaceId} by user ${cleanUserId}`);
    this.logger.log(`File details: size=${file.size} bytes, type=${file.mimetype}`);

    try {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
      });

      if (!workspace) {
        throw new NotFoundException(`Workspace with ID ${workspaceId} not found`);
      }

      const uploadResult = await this.storageService.upload(
        storageKey,
        file.buffer,
        file.mimetype,
        workspaceId,
      );

      const fileRecord = await this.prisma.file.create({
        data: {
          name: sanitizedName,
          storageProvider: 's3',
          storageKey: uploadResult.key,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          workspaceId: workspaceId,
          userId: cleanUserId,
        },
      });

      this.logger.log(`File ${fileRecord.id} uploaded and metadata saved with workspace ${workspaceId}`);
      return plainToInstance(FileResponseDto, fileRecord);
    } catch (error) {
      this.logger.error(`File upload failed for workspace ${workspaceId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findFilesByWorkspace(
    workspaceId: string,
    paginationOptions?: { page?: number; pageSize?: number },
  ): Promise<ListFilesDto> {
    const page = paginationOptions?.page ?? 1;
    const pageSize = paginationOptions?.pageSize ?? 10;
    const skip = (page - 1) * pageSize;

    try {
      const [files, total] = await Promise.all([
        this.prisma.file.findMany({
          where: { workspaceId: workspaceId },
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
        this.prisma.file.count({ where: { workspaceId: workspaceId } }),
      ]);

      return plainToInstance(ListFilesDto, {
        data: files.map(file => {
          const fileDto = plainToInstance(FileResponseDto, file);
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
      this.logger.error(`Error finding files for workspace ${workspaceId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findFileById(fileId: string, workspaceId: string): Promise<FileResponseDto> {
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, workspaceId: workspaceId },
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
    workspaceId: string,
  ): Promise<{ storageKey: string; name: string }> {
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, workspaceId: workspaceId },
      select: { storageKey: true, name: true },
    });

    if (!file) {
      throw new NotFoundException(`File with ID ${fileId} not found`);
    }

    return file;
  }

  async getDownloadUrl(fileId: string, workspaceId: string): Promise<string> {
    const metadata = await this.getFileMetadataForDownload(fileId, workspaceId);
    return this.storageService.getSignedDownloadUrl(metadata.storageKey, workspaceId);
  }

  async deleteFile(fileId: string, workspaceId: string, userId: string, isAdmin = false): Promise<void> {
    let cleanUserId = userId;
    
    if (userId?.includes(',')) {
      cleanUserId = userId.split(',')[0];
      this.logger.warn(`Received comma-separated userId for deletion: ${userId}, using first value: ${cleanUserId}`);
    } else if (Array.isArray(userId)) {
      cleanUserId = userId[0];
      this.logger.warn(`Received array userId for deletion: ${userId}, using first value: ${cleanUserId}`);
    }
    
    if (!cleanUserId || typeof cleanUserId !== 'string') {
      this.logger.error(`Invalid userId provided for deletion: ${userId}. Using default placeholder.`);
      cleanUserId = 'unknown-user';
    }
    
    this.logger.log(`Delete request for file ${fileId} in workspace ${workspaceId} by user ${cleanUserId}`);
    
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, workspaceId: workspaceId },
    });
    
    if (!file) {
      throw new NotFoundException(`File with ID ${fileId} not found`);
    }
    
    if (!isAdmin && file.userId !== cleanUserId) {
      this.logger.warn(`Permission denied: User ${cleanUserId} attempting to delete file ${fileId} owned by ${file.userId}`);
      throw new BadRequestException('You do not have permission to delete this file');
    }
    
    try {
      await this.storageService.delete(file.storageKey, workspaceId);
      
      await this.prisma.file.delete({
        where: { id: fileId },
      });
      
      this.logger.log(`File ${fileId} deleted successfully for workspace ${workspaceId} by user ${cleanUserId}`);
    } catch (error) {
      this.logger.error(`Failed to delete file ${fileId}: ${error.message}`, error.stack);
      throw error;
    }
  }
}