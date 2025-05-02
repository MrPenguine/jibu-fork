import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  Req,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { FileService } from './file.service';
import { FileResponseDto } from './dto/file-response.dto';
import { ListFilesDto } from './dto/list-files.dto';
import { Logger } from '@nestjs/common';

interface AuthenticatedRequest {
  user: {
    userId: string;
    email: string;
    orgId?: string;
    orgRole?: string;
  };
  headers: {
    [key: string]: string | string[];
  };
  body: any;
}

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@ApiTags('Files')
@Controller('files')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FileController {
  private readonly logger = new Logger(FileController.name);

  constructor(private readonly fileService: FileService) {}

  @Post()
  @ApiOperation({ summary: 'Upload a file' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'File uploaded successfully',
    type: FileResponseDto,
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
          new FileTypeValidator({ fileType: /(pdf|txt|jpg|jpeg|png|doc|docx)$/i }),
        ],
      }),
    )
    file: MulterFile,
    @Req() req: AuthenticatedRequest,
    @Query('orgId') queryOrgId: string,
    @Query('userId') queryUserId: string,
  ): Promise<FileResponseDto> {
    this.logger.log(`File upload request received. File: ${file.originalname}, Size: ${file.size}`);
    
    // For debugging purposes
    this.logger.log(`Request headers: ${JSON.stringify(req.headers)}`);
    this.logger.log(`Request body: ${JSON.stringify(req.body)}`);
    this.logger.log(`Query params - orgId: ${queryOrgId}, userId: ${queryUserId}`);
    
    // Try to get user ID from multiple sources
    let userId = req.user?.userId;  // From JWT token
    
    if (!userId) {
      userId = queryUserId;  // From query param
    }
    
    if (!userId && req.headers['x-user-id']) {
      userId = req.headers['x-user-id'] as string;  // From header
    }
    
    if (!userId && req.body?.userId) {
      userId = req.body.userId;  // From form data
    }
    
    // Try to get org ID from multiple sources
    const orgId = req.user?.orgId || queryOrgId || req.headers['x-organization-id'] as string || req.body?.organizationId;
    
    if (!orgId) {
      throw new BadRequestException('Organization ID is required');
    }
    
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    
    this.logger.log(`Processing file upload for orgId: ${orgId}, userId: ${userId}`);
    return this.fileService.uploadAndCreateFileMetadata(orgId, userId, file);
  }

  @Get()
  @ApiOperation({ summary: 'List files for organization' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Files retrieved successfully',
    type: ListFilesDto,
  })
  async listFiles(
    @Req() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('orgId') queryOrgId?: string,
  ): Promise<ListFilesDto> {
    this.logger.log(`List files request received`);
    
    // Try to get org ID from multiple sources
    const orgId = req.user?.orgId || queryOrgId || req.headers['x-organization-id'] as string;
    
    if (!orgId) {
      throw new BadRequestException('Organization ID is required');
    }
    
    this.logger.log(`Listing files for orgId: ${orgId}`);
    return this.fileService.findFilesByOrg(orgId, {
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get file metadata by ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'File metadata retrieved successfully',
    type: FileResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'File not found',
  })
  async getFileById(
    @Param('id') fileId: string,
    @Req() req: AuthenticatedRequest,
    @Query('orgId') queryOrgId?: string,
  ): Promise<FileResponseDto> {
    this.logger.log(`Get file request received for fileId: ${fileId}`);
    
    // Try to get org ID from multiple sources
    const orgId = req.user?.orgId || queryOrgId || req.headers['x-organization-id'] as string;
    
    if (!orgId) {
      throw new BadRequestException('Organization ID is required');
    }
    
    this.logger.log(`Getting file details for fileId: ${fileId}, orgId: ${orgId}`);
    return this.fileService.findFileById(fileId, orgId);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Get download URL for a file' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Download URL generated successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'File not found',
  })
  async getDownloadUrl(
    @Param('id') fileId: string,
    @Req() req: AuthenticatedRequest,
    @Query('orgId') queryOrgId?: string,
  ): Promise<{ downloadUrl: string }> {
    this.logger.log(`Get download URL request received for fileId: ${fileId}`);
    
    // Try to get org ID from multiple sources
    const orgId = req.user?.orgId || queryOrgId || req.headers['x-organization-id'] as string;
    
    if (!orgId) {
      throw new BadRequestException('Organization ID is required');
    }
    
    this.logger.log(`Getting download URL for fileId: ${fileId}, orgId: ${orgId}`);
    const url = await this.fileService.getDownloadUrl(fileId, orgId);
    return { downloadUrl: url };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a file' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'File deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'File not found',
  })
  async deleteFile(
    @Param('id') fileId: string,
    @Req() req: AuthenticatedRequest,
    @Query('orgId') queryOrgId?: string,
    @Query('userId') queryUserId?: string,
  ): Promise<void> {
    this.logger.log(`Delete file request received for fileId: ${fileId}`);
    
    // Try to get org ID from multiple sources
    const orgId = req.user?.orgId || queryOrgId || req.headers['x-organization-id'] as string;
    
    // Try to get user ID from multiple sources
    let userId = req.user?.userId;  // From JWT token
    
    if (!userId) {
      userId = queryUserId;  // From query param
    }
    
    if (!userId && req.headers['x-user-id']) {
      userId = req.headers['x-user-id'] as string;  // From header
    }
    
    if (!orgId) {
      throw new BadRequestException('Organization ID is required');
    }
    
    if (!userId) {
      throw new BadRequestException('User ID is required for file deletion');
    }

    // Check if user has admin/owner role in the organization
    const isAdmin = req.user?.orgRole === 'admin' || req.user?.orgRole === 'owner';
    
    this.logger.log(`Deleting file: ${fileId} for orgId: ${orgId}, userId: ${userId}, isAdmin: ${isAdmin}`);
    await this.fileService.deleteFile(fileId, orgId, userId, isAdmin);
  }
} 