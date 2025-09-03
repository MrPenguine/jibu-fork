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
  Req,
  HttpStatus,
  BadRequestException,
  Body,
  Headers,
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
    workspaceId?: string;
    workspaceRole?: string;
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

  private getWorkspaceId(req: AuthenticatedRequest, queryWorkspaceId?: string): string {
    let workspaceId = req.headers['x-force-workspace-id'] as string;
    
    if (!workspaceId && queryWorkspaceId) {
      workspaceId = queryWorkspaceId;
    }
    
    if (!workspaceId && req.headers['x-workspace-id']) {
      workspaceId = req.headers['x-workspace-id'] as string;
    }
    
    if (!workspaceId && req.body?.workspaceId) {
      workspaceId = req.body.workspaceId;
    }
    
    if (!workspaceId && req.user?.workspaceId) {
      workspaceId = req.user.workspaceId;
    }
    
    return workspaceId;
  }

  private sanitizeUserId(userId: string | undefined | string[]): string | null {
    if (!userId) return null;
    
    if (Array.isArray(userId)) {
      this.logger.warn(`Received userId as array: ${userId}, using first value`);
      return userId[0];
    }
    
    if (typeof userId === 'string' && userId.includes(',')) {
      this.logger.warn(`Received comma-separated userId: ${userId}, using first value`);
      return userId.split(',')[0];
    }
    
    return userId as string;
  }

  @Post()
  @ApiOperation({ summary: 'Upload a file' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'File uploaded successfully',
    type: FileResponseDto,
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 25 * 1024 * 1024, // 25MB limit
      },
    }),
  )
  async uploadFile(
    @UploadedFile() file: MulterFile,
    @Body('userId') bodyUserId: string,
    @Body('workspaceId') bodyWorkspaceId: string,
    @Query('workspaceId') queryWorkspaceId: string,
    @Headers('x-workspace-id') headerWorkspaceId: string,
    @Headers('x-force-workspace-id') forceWorkspaceId: string,
  ): Promise<FileResponseDto> {
    const userId = this.sanitizeUserId(bodyUserId);

    this.logger.log(`File upload request received from user: ${userId}`);
    this.logger.log(`Workspace IDs from various sources:`);
    this.logger.log(`- Query param 'workspaceId': ${queryWorkspaceId || 'not provided'}`);
    this.logger.log(`- Body param 'workspaceId': ${bodyWorkspaceId || 'not provided'}`);
    this.logger.log(`- Header 'x-workspace-id': ${headerWorkspaceId || 'not provided'}`);
    this.logger.log(`- Header 'x-force-workspace-id': ${forceWorkspaceId || 'not provided'}`);
    
    const cleanBodyWorkspaceId = bodyWorkspaceId?.includes(',') ? bodyWorkspaceId.split(',')[0] : bodyWorkspaceId;
    
    const workspaceId = forceWorkspaceId || queryWorkspaceId || cleanBodyWorkspaceId || headerWorkspaceId;
    
    if (!workspaceId) {
      this.logger.error('No workspace ID provided in request');
      throw new BadRequestException('Workspace ID is required');
    }
    
    if (!userId) {
      this.logger.error('No user ID provided in request');
      throw new BadRequestException('User ID is required');
    }
    
    if (!file) {
      this.logger.error('No file uploaded');
      throw new BadRequestException('No file uploaded');
    }
    
    this.logger.log(`Using workspace ID: ${workspaceId} for file upload`);
    this.logger.log(`Using user ID: ${userId} for file upload`);
    this.logger.log(`File details: name=${file.originalname}, size=${file.size}, type=${file.mimetype}`);
    
    return this.fileService.uploadAndCreateFileMetadata(workspaceId, userId, file);
  }

  @Get()
  @ApiOperation({ summary: 'List files for workspace' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Files retrieved successfully',
    type: ListFilesDto,
  })
  async listFiles(
    @Req() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('workspaceId') queryWorkspaceId?: string,
  ): Promise<ListFilesDto> {
    this.logger.log(`List files request received. Query params - workspaceId: ${queryWorkspaceId}`);
    
    const workspaceId = this.getWorkspaceId(req, queryWorkspaceId);
    
    if (!workspaceId) {
      throw new BadRequestException('Workspace ID is required');
    }
    
    this.logger.log(`Listing files for workspaceId: ${workspaceId}`);
    return this.fileService.findFilesByWorkspace(workspaceId, {
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
    @Query('workspaceId') queryWorkspaceId?: string,
    @Query('userId') queryUserId?: string,
  ): Promise<FileResponseDto> {
    this.logger.log(`Get file request received for fileId: ${fileId}. Query params - workspaceId: ${queryWorkspaceId}, userId: ${queryUserId}`);
    
    const workspaceId = this.getWorkspaceId(req, queryWorkspaceId);
    
    const userId = this.sanitizeUserId(queryUserId || req.user?.userId);
    if (userId) {
      this.logger.log(`Request from user: ${userId}`);
    }
    
    if (!workspaceId) {
      throw new BadRequestException('Workspace ID is required');
    }
    
    this.logger.log(`Getting file details for fileId: ${fileId}, workspaceId: ${workspaceId}`);
    return this.fileService.findFileById(fileId, workspaceId);
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
    @Query('workspaceId') queryWorkspaceId?: string,
    @Query('userId') queryUserId?: string,
  ): Promise<{ downloadUrl: string }> {
    this.logger.log(`Get download URL request received for fileId: ${fileId}. Query params - workspaceId: ${queryWorkspaceId}, userId: ${queryUserId}`);
    
    const workspaceId = this.getWorkspaceId(req, queryWorkspaceId);
    
    const userId = this.sanitizeUserId(queryUserId || req.user?.userId);
    if (userId) {
      this.logger.log(`Download URL request from user: ${userId}`);
    }
    
    if (!workspaceId) {
      throw new BadRequestException('Workspace ID is required');
    }
    
    this.logger.log(`Getting download URL for fileId: ${fileId}, workspaceId: ${workspaceId}`);
    const url = await this.fileService.getDownloadUrl(fileId, workspaceId);
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
    @Query('workspaceId') queryWorkspaceId?: string,
    @Query('userId') queryUserId?: string,
    @Headers('x-user-id') headerUserId?: string,
  ): Promise<void> {
    this.logger.log(`Delete file request received for fileId: ${fileId}`);
    this.logger.log(`Query params - workspaceId: ${queryWorkspaceId}, userId: ${queryUserId}`);
    this.logger.log(`Headers - x-user-id: ${headerUserId || 'not provided'}`);
    
    const workspaceId = this.getWorkspaceId(req, queryWorkspaceId);
    
    let userId = this.sanitizeUserId(queryUserId);
    
    if (!userId && headerUserId) {
      userId = this.sanitizeUserId(headerUserId);
    }
    
    if (!userId && req.headers['x-user-id']) {
      userId = this.sanitizeUserId(req.headers['x-user-id'] as string);
    }
    
    if (!userId && req.user?.userId) {
      userId = this.sanitizeUserId(req.user.userId);
    }
    
    if (!workspaceId) {
      this.logger.error('No workspace ID provided for file deletion');
      throw new BadRequestException('Workspace ID is required');
    }
    
    if (!userId) {
      this.logger.error('No user ID provided for file deletion');
      throw new BadRequestException('User ID is required for file deletion');
    }

    const isAdmin = req.user?.workspaceRole === 'admin' || req.user?.workspaceRole === 'owner';
    
    this.logger.log(`Deleting file: ${fileId} for workspaceId: ${workspaceId}, userId: ${userId}, isAdmin: ${isAdmin}`);
    await this.fileService.deleteFile(fileId, workspaceId, userId, isAdmin);
  }
}