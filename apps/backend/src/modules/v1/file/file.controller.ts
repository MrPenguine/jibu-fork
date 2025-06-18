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

  // Helper function to get organization ID with consistent priority
  private getOrganizationId(req: AuthenticatedRequest, queryOrgId?: string): string {
    // 1. Force header - highest priority for switching organizations
    let orgId = req.headers['x-force-organization-id'] as string;
    
    // 2. Organization ID from query param with 'orgId' key
    if (!orgId && queryOrgId) {
      orgId = queryOrgId;
    }
    
    // 3. Organization from a query param named 'organization' (for compatibility)
    // Skip this check as the request object doesn't have a query property
    
    // 4. Standard organization header
    if (!orgId && req.headers['x-organization-id']) {
      orgId = req.headers['x-organization-id'] as string;
    }
    
    // 5. Organization from body (for POST/PUT requests)
    if (!orgId && req.body?.organizationId) {
      orgId = req.body.organizationId;
    }
    
    // 6. Organization from JWT token (lowest priority since it might be outdated)
    if (!orgId && req.user?.orgId) {
      orgId = req.user.orgId;
    }
    
    return orgId;
  }

  // Helper function to sanitize userId
  private sanitizeUserId(userId: string | undefined | string[]): string | null {
    if (!userId) return null;
    
    // Handle array values
    if (Array.isArray(userId)) {
      this.logger.warn(`Received userId as array: ${userId}, using first value`);
      return userId[0];
    }
    
    // Handle comma-separated values
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
    @Body('organizationId') bodyOrgId: string,
    @Query('orgId') queryOrgId: string,
    @Query('organization') queryOrganization: string,
    @Headers('x-organization-id') headerOrgId: string,
    @Headers('x-force-organization-id') forceOrgId: string,
  ): Promise<FileResponseDto> {
    // Fix duplicate userId issue - if userId contains commas, take first value
    const userId = this.sanitizeUserId(bodyUserId);

    // Log all sources of organization ID to help debug issues
    this.logger.log(`File upload request received from user: ${userId}`);
    this.logger.log(`Organization IDs from various sources:`);
    this.logger.log(`- Query param 'orgId': ${queryOrgId || 'not provided'}`);
    this.logger.log(`- Query param 'organization': ${queryOrganization || 'not provided'}`);
    this.logger.log(`- Body param 'organizationId': ${bodyOrgId || 'not provided'}`);
    this.logger.log(`- Header 'x-organization-id': ${headerOrgId || 'not provided'}`);
    this.logger.log(`- Header 'x-force-organization-id': ${forceOrgId || 'not provided'}`);
    
    // Fix duplicate organizationId issue - if bodyOrgId contains commas, take first value
    const cleanBodyOrgId = bodyOrgId?.includes(',') ? bodyOrgId.split(',')[0] : bodyOrgId;
    
    // Precedence: 1. force header, 2. query param, 3. body param, 4. regular header
    const orgId = forceOrgId || queryOrgId || queryOrganization || cleanBodyOrgId || headerOrgId;
    
    if (!orgId) {
      this.logger.error('No organization ID provided in request');
      throw new BadRequestException('Organization ID is required');
    }
    
    if (!userId) {
      this.logger.error('No user ID provided in request');
      throw new BadRequestException('User ID is required');
    }
    
    if (!file) {
      this.logger.error('No file uploaded');
      throw new BadRequestException('No file uploaded');
    }
    
    this.logger.log(`Using organization ID: ${orgId} for file upload`);
    this.logger.log(`Using user ID: ${userId} for file upload`);
    this.logger.log(`File details: name=${file.originalname}, size=${file.size}, type=${file.mimetype}`);
    
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
    @Query('organization') queryOrganization?: string,
  ): Promise<ListFilesDto> {
    this.logger.log(`List files request received. Query params - orgId: ${queryOrgId}, organization: ${queryOrganization}`);
    
    // Get org ID with consistent priority - also consider the organization query param
    const orgId = queryOrganization || this.getOrganizationId(req, queryOrgId);
    
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
    @Query('organization') queryOrganization?: string,
    @Query('userId') queryUserId?: string,
  ): Promise<FileResponseDto> {
    this.logger.log(`Get file request received for fileId: ${fileId}. Query params - orgId: ${queryOrgId}, organization: ${queryOrganization}, userId: ${queryUserId}`);
    
    // Get org ID with consistent priority - also consider the organization query param
    const orgId = queryOrganization || this.getOrganizationId(req, queryOrgId);
    
    // Sanitize user ID in case it's being passed and used later
    const userId = this.sanitizeUserId(queryUserId || req.user?.userId);
    if (userId) {
      this.logger.log(`Request from user: ${userId}`);
    }
    
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
    @Query('organization') queryOrganization?: string,
    @Query('userId') queryUserId?: string,
  ): Promise<{ downloadUrl: string }> {
    this.logger.log(`Get download URL request received for fileId: ${fileId}. Query params - orgId: ${queryOrgId}, organization: ${queryOrganization}, userId: ${queryUserId}`);
    
    // Get org ID with consistent priority - also consider the organization query param
    const orgId = queryOrganization || this.getOrganizationId(req, queryOrgId);
    
    // Sanitize user ID in case it's being passed and used later
    const userId = this.sanitizeUserId(queryUserId || req.user?.userId);
    if (userId) {
      this.logger.log(`Download URL request from user: ${userId}`);
    }
    
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
    @Query('organization') queryOrganization?: string,
    @Headers('x-user-id') headerUserId?: string,
  ): Promise<void> {
    this.logger.log(`Delete file request received for fileId: ${fileId}`);
    this.logger.log(`Query params - orgId: ${queryOrgId}, organization: ${queryOrganization}, userId: ${queryUserId}`);
    this.logger.log(`Headers - x-user-id: ${headerUserId || 'not provided'}`);
    
    // Get org ID with consistent priority - also consider the organization query param
    const orgId = queryOrganization || this.getOrganizationId(req, queryOrgId);
    
    // Try to get user ID from multiple sources with clear priority
    // Use sanitizeUserId on each source to prevent array/comma issues
    // 1. Query param (highest priority)
    let userId = this.sanitizeUserId(queryUserId);
    
    // 2. Header
    if (!userId && headerUserId) {
      userId = this.sanitizeUserId(headerUserId);
    }
    
    // 3. Request header
    if (!userId && req.headers['x-user-id']) {
      userId = this.sanitizeUserId(req.headers['x-user-id'] as string);
    }
    
    // 4. JWT token (lowest priority as it might be outdated)
    if (!userId && req.user?.userId) {
      userId = this.sanitizeUserId(req.user.userId);
    }
    
    if (!orgId) {
      this.logger.error('No organization ID provided for file deletion');
      throw new BadRequestException('Organization ID is required');
    }
    
    if (!userId) {
      this.logger.error('No user ID provided for file deletion');
      throw new BadRequestException('User ID is required for file deletion');
    }

    // Check if user has admin/owner role in the organization
    const isAdmin = req.user?.orgRole === 'admin' || req.user?.orgRole === 'owner';
    
    this.logger.log(`Deleting file: ${fileId} for orgId: ${orgId}, userId: ${userId}, isAdmin: ${isAdmin}`);
    await this.fileService.deleteFile(fileId, orgId, userId, isAdmin);
  }
} 