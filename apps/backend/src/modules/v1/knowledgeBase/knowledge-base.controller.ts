import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { KnowledgeBaseService } from './knowledge-base.service';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge-base.dto';
import { UpdateKnowledgeBaseDto } from './dto/update-knowledge-base.dto';
import { LinkFileSourceDto } from './dto/link-file-source.dto';
import { LinkUrlSourceDto } from './dto/link-url-source.dto';
import { KnowledgeBaseSettingsDto } from './dto/knowledge-base-settings.dto';
import { UpdateChunkDto, RetrieveTestDto } from './dto/update-chunk.dto';
import { Query } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

@ApiTags('Knowledge Bases')
@ApiBearerAuth()
@Controller('v1/knowledge-bases')
@UseGuards(JwtAuthGuard)
export class KnowledgeBaseController {
  private readonly logger = new Logger(KnowledgeBaseController.name);

  constructor(
    private readonly knowledgeBaseService: KnowledgeBaseService,
    private readonly prisma: PrismaService
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new knowledge base' })
  @ApiResponse({ status: 201, description: 'The knowledge base has been created' })
  async create(@Req() req, @Body() createKnowledgeBaseDto: CreateKnowledgeBaseDto) {
    try {
      // Get user ID from JWT token
      const userId = req.user.id;
      
      // PRIORITY ORDER FOR ORGANIZATION ID:
      // 1. First use organization ID from the request body (if provided)
      // 2. Then from x-workspace-id or organization-id header 
      // 3. Finally from user token
      let orgId = createKnowledgeBaseDto.workspaceId;
      
      // If not in request body, try headers in various formats
      if (!orgId) {
        // Check multiple header formats to be thorough
        orgId = req.headers['x-workspace-id'] || 
                req.headers['organization-id'] || 
                req.headers['x-force-organization-id'];
        
        if (orgId) {
          this.logger.log(`Using orgId from header: ${orgId}`);
        }
      } else {
        this.logger.log(`Using orgId from request body: ${orgId}`);
      }
      
      // Final fallback to user token
      if (!orgId) {
        orgId = req.user.orgId;
        if (orgId) {
          this.logger.log(`Using orgId from user token (fallback): ${orgId}`);
        }
      }

      this.logger.log(`Creating KB: ${JSON.stringify({
        name: createKnowledgeBaseDto.name,
        orgId,
        userId
      })}`);
    
    if (!orgId) {
        this.logger.error('No organization ID provided');
        throw new NotFoundException('Organization ID is required to create a knowledge base');
    }
    
      try {
        // Skip organization existence check to avoid problems with missing organizations
        // This allows knowledge bases to be created for organizations managed in external systems
        const result = await this.knowledgeBaseService.createKnowledgeBase(
      orgId,
      userId,
          createKnowledgeBaseDto
        );
        
        // Ensure workspaceId is included in the response
        if (result) {
          // Check if the result has the proper workspaceId
          if (!result.workspaceId) {
            this.logger.log(`Adding missing workspaceId ${orgId} to KB response`);
            result.workspaceId = orgId;
          } else if (result.workspaceId !== orgId) {
            this.logger.warn(`KB created with different workspaceId: ${result.workspaceId} vs expected ${orgId}`);
            // Update the response object to use the correct ID
            result.workspaceId = orgId;
            
            // Also update the database record to fix any discrepancy
            try {
              // @ts-ignore - PrismaClient models are not properly typed
              await this.prisma.knowledgeBase.update({
                where: { id: result.id },
                data: { workspaceId: orgId }
              });
              this.logger.log(`Fixed workspaceId mismatch in database for KB ${result.id}`);
            } catch (updateError) {
              this.logger.error(`Failed to update KB with correct workspaceId: ${updateError.message}`);
            }
          }
        }
        
        this.logger.log(`KB created: ${result?.id} with workspaceId: ${result?.workspaceId}`);
        return result;
      } catch (error) {
        this.logger.error(`Error creating KB: ${error.message}`, error.stack);
        throw error;
      }
    } catch (error) {
      this.logger.error(`Error in create KB endpoint: ${error.message}`, error.stack);
      
      // Handle specific error types
      if (error instanceof NotFoundException) {
        throw error; // Let NestJS handle the 404 response
      }
      
      // For general errors, return a structured error response
      return { 
        error: error.message || 'An error occurred while creating the knowledge base', 
        status: error.status || 500 
      };
    }
  }

  @Get()
  @ApiOperation({ summary: 'List all knowledge bases for the organization' })
  @ApiResponse({ status: 200, description: 'Returns all knowledge bases' })
  async findAll(@Req() req) {
    try {
      // Get organization ID from headers first, then fall back to JWT token
      const orgId = req.headers['x-workspace-id'] || 
                   req.headers['organization-id'] || 
                   req.headers['x-force-organization-id'] || 
                   req.user.orgId;
      
      if (!orgId) {
        this.logger.error('[findAll] No organization ID found in headers or token');
        throw new NotFoundException('Organization ID is required to list knowledge bases');
      }
      
      this.logger.log(`[findAll] Listing knowledge bases for organization: ${orgId}`);
      return this.knowledgeBaseService.listKnowledgeBasesForWorkspace(orgId);
    } catch (error) {
      this.logger.error(`[findAll] Error listing knowledge bases: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a knowledge base by ID' })
  @ApiResponse({ status: 200, description: 'Returns the knowledge base' })
  @ApiResponse({ status: 404, description: 'Knowledge base not found' })
  @ApiParam({ name: 'id', description: 'Knowledge Base ID' })
  async findOne(
    @Req() req, 
    @Param('id') id: string,
  ) {
    return this.knowledgeBaseService.findKnowledgeBaseById(id, req.user.orgId);
  }

  @Get(':id/chunks')
  @ApiOperation({ summary: 'Get all chunks for a knowledge base' })
  @ApiResponse({ status: 200, description: 'Returns the chunks metadata for the knowledge base' })
  @ApiResponse({ status: 404, description: 'Knowledge base not found' })
  @ApiParam({ name: 'id', description: 'Knowledge Base ID' })
  async getKnowledgeBaseChunks(
    @Req() req,
    @Param('id') id: string,
  ) {
    try {
      const orgId = req.headers['x-workspace-id'] || 
                   req.headers['organization-id'] || 
                   req.headers['x-force-organization-id'] || 
                   req.user.orgId;
      
      this.logger.log(`[getKnowledgeBaseChunks] Getting chunks for knowledge base: ${id} in org: ${orgId}`);
      return this.knowledgeBaseService.getKnowledgeBaseChunks(id, orgId);
    } catch (error) {
      this.logger.error(`[getKnowledgeBaseChunks] Error getting chunks: ${error.message}`, error.stack);
      throw error;
    }
  }
  
  @Get(':id/chunks/stats')
  @ApiOperation({ summary: 'Get chunk statistics for a knowledge base' })
  @ApiResponse({ status: 200, description: 'Returns statistics about the chunks in the knowledge base' })
  @ApiResponse({ status: 404, description: 'Knowledge base not found' })
  @ApiParam({ name: 'id', description: 'Knowledge Base ID' })
  async getKnowledgeBaseChunkStats(
    @Req() req,
    @Param('id') id: string,
  ) {
    try {
      const orgId = req.headers['x-workspace-id'] || 
                   req.headers['organization-id'] || 
                   req.headers['x-force-organization-id'] || 
                   req.user.orgId;
      
      this.logger.log(`[getKnowledgeBaseChunkStats] Getting chunk stats for knowledge base: ${id} in org: ${orgId}`);
      return this.knowledgeBaseService.getKnowledgeBaseChunkStats(id, orgId);
    } catch (error) {
      this.logger.error(`[getKnowledgeBaseChunkStats] Error getting chunk stats: ${error.message}`, error.stack);
      throw error;
    }
  }
  
  @Get(':id/sources/:sourceId/chunks')
  @ApiOperation({ summary: 'Get chunks for a specific source in a knowledge base' })
  @ApiResponse({ status: 200, description: 'Returns the chunks metadata for the specified source' })
  @ApiResponse({ status: 404, description: 'Knowledge base or source not found' })
  @ApiParam({ name: 'id', description: 'Knowledge Base ID' })
  @ApiParam({ name: 'sourceId', description: 'Knowledge Base Source ID' })
  async getSourceChunks(
    @Req() req,
    @Param('id') id: string,
    @Param('sourceId') sourceId: string,
  ) {
    try {
      const orgId = req.headers['x-workspace-id'] || 
                   req.headers['organization-id'] || 
                   req.headers['x-force-organization-id'] || 
                   req.user.orgId;
      
      this.logger.log(`[getSourceChunks] Getting chunks for source: ${sourceId} in knowledge base: ${id}, org: ${orgId}`);
      return this.knowledgeBaseService.getSourceChunks(id, sourceId, orgId);
    } catch (error) {
      this.logger.error(`[getSourceChunks] Error getting source chunks: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a knowledge base' })
  @ApiResponse({ status: 200, description: 'The knowledge base has been updated' })
  @ApiResponse({ status: 404, description: 'Knowledge base not found' })
  @ApiParam({ name: 'id', description: 'Knowledge Base ID' })
  async update(
    @Req() req,
    @Param('id') id: string,
    @Body() updateKnowledgeBaseDto: UpdateKnowledgeBaseDto,
  ) {
    return this.knowledgeBaseService.updateKnowledgeBase(
      id,
      req.user.orgId,
      updateKnowledgeBaseDto,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a knowledge base' })
  @ApiResponse({ status: 200, description: 'The knowledge base has been deleted' })
  @ApiResponse({ status: 404, description: 'Knowledge base not found' })
  @ApiParam({ name: 'id', description: 'Knowledge Base ID' })
  async remove(
    @Req() req, 
    @Param('id') id: string,
  ) {
    return this.knowledgeBaseService.deleteKnowledgeBase(id, req.user.orgId);
  }

  @Post(':id/sources')
  @ApiOperation({ summary: 'Link a file to a knowledge base' })
  @ApiResponse({ status: 201, description: 'The file has been linked' })
  @ApiResponse({ status: 404, description: 'Knowledge base or file not found' })
  @ApiParam({ name: 'id', description: 'Knowledge Base ID' })
  async linkFile(
    @Req() req,
    @Param('id') id: string,
    @Body() linkFileSourceDto: LinkFileSourceDto,
  ) {
    try {
      // PRIORITY ORDER:
      // 1. First use organization ID from the request body (if provided)
      // 2. Then from x-workspace-id or organization-id header 
      // 3. Finally from user token
      let orgId = linkFileSourceDto.workspaceId;
      const userId = req.user.userId || req.user.id;
      
      // If not in request body, try headers
      if (!orgId) {
        orgId = req.headers['x-workspace-id'] || req.headers['organization-id'];
        if (orgId) {
          this.logger.log(`Using orgId from header: ${orgId}`);
        }
      } else {
        this.logger.log(`Using orgId from request body: ${orgId}`);
      }
      
      // Final fallback to user token
      if (!orgId) {
        orgId = req.user.orgId;
        if (orgId) {
          this.logger.log(`Using orgId from user token (fallback): ${orgId}`);
        }
      }
    
    if (!orgId) {
        this.logger.error('No organization ID provided in request');
        throw new NotFoundException('Organization ID is required');
      }

      this.logger.log(`Linking file ${linkFileSourceDto.fileId} to KB ${id} for organization ${orgId}`);
    
      try {
        // First check if the knowledge base exists at all
        // @ts-ignore - PrismaClient models are not properly typed
        const anyKnowledgeBase = await this.prisma.knowledgeBase.findUnique({
          where: { id: id }
        });
        
        if (!anyKnowledgeBase) {
          this.logger.error(`Knowledge base ${id} not found in any organization`);
          throw new NotFoundException(`Knowledge base with ID ${id} not found`);
        }
        
        // If found but belongs to another organization, print a warning but proceed
        // This handles cases where organization IDs might be different across systems
        if (anyKnowledgeBase.workspaceId !== orgId) {
          this.logger.warn(`Knowledge base ${id} belongs to organization ${anyKnowledgeBase.workspaceId}, not ${orgId}. Will proceed anyway but this might indicate a configuration issue.`);
          
          // Option 1: Proceed with the request organization ID (current approach)
          // Keep orgId as is from the request
          
          // Option 2: Use the knowledge base's organization ID (alternative approach)
          // orgId = anyKnowledgeBase.workspaceId;
          // this.logger.log(`Switching to knowledge base's organization ID: ${orgId}`);
        }
      } catch (error) {
        // If it's not a NotFoundException, re-throw it
        if (!(error instanceof NotFoundException)) {
          throw error;
        }
        
        // For Not Found errors, we'll let the service handle it
        this.logger.warn(`Error checking knowledge base existence: ${error.message}`);
      }
    
      // Call service method to link the file
      const source = await this.knowledgeBaseService.linkFileSource(
        id,
        linkFileSourceDto.fileId,
        orgId,
        userId,
        linkFileSourceDto.folderId,
        {
          strategies: linkFileSourceDto.chunkingStrategy,
          chunkSize: linkFileSourceDto.chunkSize,
          chunkOverlap: linkFileSourceDto.chunkOverlap,
        },
      );
      
      this.logger.log(`Successfully linked file to KB: ${JSON.stringify({
        sourceId: source.id,
        knowledgeBaseId: source.knowledgeBaseId,
        workspaceId: source.workspaceId || orgId
      })}`);
      
      // Return the source object directly without additional wrapping
      if (source && source.id) {
        // Ensure source has correct organization ID
        if (!source.workspaceId) {
          source.workspaceId = orgId;
          this.logger.warn(`Added missing workspaceId ${orgId} to source response`);
        } else if (source.workspaceId !== orgId) {
          this.logger.warn(`Source has different workspaceId (${source.workspaceId}) than requested (${orgId}), correcting...`);
          source.workspaceId = orgId;
        }
        
        return source;
      } else {
        throw new Error('Invalid source object returned from service');
      }
    } catch (error) {
      this.logger.error(`Error linking file to knowledge base: ${error.message}`, error.stack);
      
      if (error instanceof NotFoundException) {
        throw error; // Let NestJS handle the 404 response
      }
      
      throw error; // Let NestJS handle the error
    }
  }

  @Delete('sources/:sourceId')
  @ApiOperation({ summary: 'Unlink a source from a knowledge base' })
  @ApiResponse({ status: 200, description: 'The source has been unlinked' })
  @ApiResponse({ status: 404, description: 'Source not found' })
  @ApiParam({ name: 'sourceId', description: 'Source ID' })
  async unlinkSource(
    @Req() req, 
    @Param('sourceId') sourceId: string,
  ) {
    // Get orgId from headers first, then fallback to user token
    let orgId = req.headers['x-workspace-id'] || req.headers['organization-id'];
    const userId = req.user.userId || req.user.id;
    
    // Fallback to user token
    if (!orgId) {
      orgId = req.user.orgId;
      if (orgId) {
        this.logger.log(`Using orgId from user token (fallback): ${orgId}`);
      }
    } else {
      this.logger.log(`Using orgId from header: ${orgId}`);
    }
    
    if (!orgId) {
      this.logger.error('No organization ID provided in request');
      throw new NotFoundException('Organization ID is required');
    }
    
    this.logger.log(`Unlinking source ${sourceId} for workspace ${orgId}`);
    
    return this.knowledgeBaseService.unlinkFileSource(sourceId, orgId, userId);
  }

  @Get(':id/sources')
  @ApiOperation({ summary: 'List all sources for a knowledge base' })
  @ApiResponse({ status: 200, description: 'Returns all sources' })
  @ApiResponse({ status: 404, description: 'Knowledge base not found' })
  @ApiParam({ name: 'id', description: 'Knowledge Base ID' })
  async listSources(
    @Req() req, 
    @Param('id') id: string,
  ) {
    try {
      // PRIORITY ORDER:
      // 1. First use organization ID from the request body (if provided)
      // 2. Then from x-workspace-id or organization-id header 
      // 3. Finally from user token
      let orgId = req.headers['x-workspace-id'] || req.headers['organization-id'];
      const userId = req.user.userId || req.user.id;
      
      // Final fallback to user token
      if (!orgId) {
        orgId = req.user.orgId;
        if (orgId) {
          this.logger.log(`Using orgId from user token (fallback): ${orgId}`);
        }
      } else {
        this.logger.log(`Using orgId from header: ${orgId}`);
      }
    
    if (!orgId) {
        this.logger.error('No organization ID provided in request');
        throw new NotFoundException('Organization ID is required');
      }
      
      this.logger.log(`Listing sources for KB ${id} with organization ${orgId}`);
      
      // Check if the knowledge base exists with this organization ID
      // @ts-ignore - PrismaClient models are not properly typed
      const knowledgeBase = await this.prisma.knowledgeBase.findFirst({
        where: {
          id: id,
          workspaceId: orgId,
        },
      });

      if (!knowledgeBase) {
        this.logger.error(`Knowledge base ${id} not found for organization ${orgId}`);
        throw new NotFoundException(`Knowledge base with ID ${id} not found for organization ${orgId}`);
      }
      
      // Get all sources for this knowledge base
      const sources = await this.knowledgeBaseService.listSourcesForKb(id, orgId);
      
      // Log the results
      this.logger.log(`Found ${sources.length} sources for KB ${id}`);
      
      return sources;
    } catch (error) {
      this.logger.error(`Error listing sources for knowledge base: ${error.message}`, error.stack);
      
      if (error instanceof NotFoundException) {
        throw error; // Let NestJS handle the 404 response
      }
      
      throw error; // Let NestJS handle the error
    }
  }

  @Post(':kbId/folders')
  @ApiOperation({ summary: 'Create a folder in workspace for knowledge base organization' })
  @ApiResponse({ status: 201, description: 'Folder created' })
  @ApiResponse({ status: 404, description: 'Knowledge base not found' })
  @ApiParam({ name: 'kbId', description: 'Knowledge Base ID' })
  async createFolder(
    @Req() req,
    @Param('kbId') kbId: string,
    @Body() body: { name: string },
  ) {
    const name = body?.name;
    if (!name || typeof name !== 'string') {
      throw new NotFoundException('Folder name is required');
    }

    let orgId = req.headers['x-workspace-id'] || req.headers['organization-id'] || req.headers['x-force-organization-id'] || req.user.orgId;

    if (!orgId) {
      throw new NotFoundException('Organization ID is required');
    }

    // @ts-ignore - PrismaClient models are not properly typed
    const knowledgeBase = await this.prisma.knowledgeBase.findFirst({ where: { id: kbId, workspaceId: orgId } });
    if (!knowledgeBase) {
      throw new NotFoundException(`Knowledge base with ID ${kbId} not found for organization ${orgId}`);
    }

    // @ts-ignore - PrismaClient models are not properly typed
    const folder = await this.prisma.folder.create({ data: { name, workspaceId: orgId } });
    return { id: folder.id, name: folder.name, workspaceId: folder.workspaceId };
  }

  @Get(':kbId/folders')
  @ApiOperation({ summary: 'List folders in workspace for knowledge base organization' })
  @ApiResponse({ status: 200, description: 'Folders list' })
  @ApiResponse({ status: 404, description: 'Knowledge base not found' })
  @ApiParam({ name: 'kbId', description: 'Knowledge Base ID' })
  async listFolders(
    @Req() req,
    @Param('kbId') kbId: string,
  ) {
    let orgId = req.headers['x-workspace-id'] || req.headers['organization-id'] || req.headers['x-force-organization-id'] || req.user.orgId;

    if (!orgId) {
      throw new NotFoundException('Organization ID is required');
    }

    // @ts-ignore - PrismaClient models are not properly typed
    const knowledgeBase = await this.prisma.knowledgeBase.findFirst({ where: { id: kbId, workspaceId: orgId } });
    if (!knowledgeBase) {
      throw new NotFoundException(`Knowledge base with ID ${kbId} not found for organization ${orgId}`);
    }

    // @ts-ignore - PrismaClient models are not properly typed
    const folders = await this.prisma.folder.findMany({ where: { workspaceId: orgId }, select: { id: true, name: true } });
    return folders;
  }

  @Delete(':kbId/folders/:folderId')
  @ApiOperation({ summary: 'Delete a folder' })
  @ApiResponse({ status: 200, description: 'Folder deleted successfully' })
  @ApiResponse({ status: 404, description: 'Folder or knowledge base not found' })
  @ApiParam({ name: 'kbId', description: 'Knowledge Base ID' })
  @ApiParam({ name: 'folderId', description: 'Folder ID' })
  async deleteFolder(
    @Req() req,
    @Param('kbId') kbId: string,
    @Param('folderId') folderId: string,
  ) {
    let orgId = req.headers['x-workspace-id'] || req.headers['organization-id'] || req.headers['x-force-organization-id'] || req.user.orgId;

    if (!orgId) {
      throw new NotFoundException('Organization ID is required');
    }

    // Verify KB exists and belongs to workspace
    // @ts-ignore - PrismaClient models are not properly typed
    const knowledgeBase = await this.prisma.knowledgeBase.findFirst({ where: { id: kbId, workspaceId: orgId } });
    if (!knowledgeBase) {
      throw new NotFoundException(`Knowledge base with ID ${kbId} not found for organization ${orgId}`);
    }

    // Verify folder exists and belongs to workspace
    // @ts-ignore - PrismaClient models are not properly typed
    const folder = await this.prisma.folder.findFirst({ where: { id: folderId, workspaceId: orgId } });
    if (!folder) {
      throw new NotFoundException(`Folder with ID ${folderId} not found for organization ${orgId}`);
    }

    // Delete the folder (cascade will handle related records if configured)
    // @ts-ignore - PrismaClient models are not properly typed
    await this.prisma.folder.delete({ where: { id: folderId } });

    return { success: true, message: 'Folder deleted successfully' };
  }

  @Post(':id/sources/:sourceId/index')
  @ApiOperation({ summary: 'Trigger indexing for a source' })
  @ApiParam({ name: 'id', description: 'Knowledge Base ID' })
  @ApiParam({ name: 'sourceId', description: 'Source ID' })
  async triggerIndexing(
    @Param('id') id: string,
    @Param('sourceId') sourceId: string,
    @Req() req
  ) {
    const orgId = req.headers['x-workspace-id'];
    
    // Find the source - use knowledgeBaseService or direct Prisma
    // @ts-ignore - PrismaClient models are not properly typed
    const source = await this.prisma.knowledgeBaseSource.findFirst({
      where: {
        id: sourceId,
        knowledgeBaseId: id,
        workspaceId: orgId,
      },
    });

    if (!source) {
      return { error: 'Source not found' };
    }

    // Manually update the source status to PROCESSING
    // @ts-ignore - PrismaClient models are not properly typed
    await this.prisma.knowledgeBaseSource.update({
      where: { id: sourceId },
      data: { indexingStatus: 'PROCESSING' },
    });

    // Add to indexing queue
    try {
      await this.knowledgeBaseService.triggerSourceIndexing(
        sourceId,
        id,
        orgId
      );
      return { success: true, message: 'Indexing started' };
    } catch (error) {
      this.logger.error(`Failed to trigger indexing for source ${sourceId}`, error);
      return { success: false, error: 'Failed to trigger indexing' };
    }
  }

  @Get('sources/:sourceId/status')
  @ApiOperation({ summary: 'Get the indexing status of a source' })
  @ApiParam({ name: 'sourceId', description: 'Source ID' })
  async getSourceStatus(@Param('sourceId') sourceId: string, @Req() req) {
    try {
      const orgId = req.headers['x-workspace-id'];
      
      // Get the source from database
      // @ts-ignore - PrismaClient models are not properly typed
      const source = await this.prisma.knowledgeBaseSource.findFirst({
        where: {
          id: sourceId,
          workspaceId: orgId,
        },
      });

      if (!source) {
        return { error: 'Source not found' };
      }

      // For now, just return the status from the database
      // Redis integration would be added later
      return {
        id: sourceId,
        knowledgeBaseId: source.knowledgeBaseId,
        status: source.indexingStatus,
        progress: source.indexingStatus === 'COMPLETED' ? 100 : 
                 source.indexingStatus === 'PROCESSING' ? 50 : 0,
      };
    } catch (error) {
      this.logger.error(`Failed to get status for source ${sourceId}`, error);
      return { error: 'Failed to get status' };
    }
  }

  @Post('link-to-assistant')
  @ApiOperation({ summary: 'Link a knowledge base to an assistant' })
  @ApiResponse({ status: 200, description: 'Knowledge base linked to assistant' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 500, description: 'Failed to link knowledge base to assistant' })
  async linkToAssistant(
    @Body() linkData: { knowledgeBaseId: string; assistantId: string; workspaceId?: string },
    @Req() req
  ) {
    try {
      // PRIORITY ORDER:
      // 1. First use organization ID from the request body (if provided)
      // 2. Then from x-workspace-id header
      // 3. Finally from user token
      let orgId = linkData.workspaceId;
      
      // If not in request body, try header
      if (!orgId) {
        orgId = req.headers['x-workspace-id'] || req.headers['organization-id'];
        if (orgId) {
          this.logger.log(`Using orgId from header: ${orgId}`);
        }
      } else {
        this.logger.log(`Using orgId from request body: ${orgId}`);
      }
      
      // Final fallback to user token
      if (!orgId) {
        orgId = req.user.orgId;
        if (orgId) {
          this.logger.log(`Using orgId from user token (fallback): ${orgId}`);
        }
      }
      
      this.logger.log(`Linking KB ${linkData.knowledgeBaseId} to assistant ${linkData.assistantId} for organization ${orgId}`);
      
      if (!orgId) {
        this.logger.error('No organization ID provided in request');
        return { success: false, error: 'Organization ID is required' };
      }
      
      // Verify the knowledge base exists and belongs to the organization
      // @ts-ignore - PrismaClient models are not properly typed
      const knowledgeBase = await this.prisma.knowledgeBase.findFirst({
        where: {
          id: linkData.knowledgeBaseId,
          workspaceId: orgId,
        },
      });

      if (!knowledgeBase) {
        this.logger.error(`Knowledge base ${linkData.knowledgeBaseId} not found for org ${orgId}`);
        return { error: 'Knowledge base not found' };
      }
      
      this.logger.log(`Found knowledge base: ${JSON.stringify(knowledgeBase)}`);

      // Verify the agent (formerly assistant) exists and belongs to the organization
      // @ts-ignore - PrismaClient models are not properly typed
      const agent = await this.prisma.agent.findFirst({
        where: {
          id: linkData.assistantId,
          workspaceId: orgId,
        },
      });

      if (!agent) {
        this.logger.error(`Agent ${linkData.assistantId} not found for org ${orgId}`);
        return { error: 'Agent not found' };
      }
      
      this.logger.log(`Found agent: ${JSON.stringify({ id: agent.id, name: agent.name })}`);

      // Update the agent metadata to link it to the knowledge base
      // @ts-ignore - Prisma client typings might be outdated; schema includes Agent.metadata Json
      const currentMetadata: any = agent.metadata || {};
      const newMetadata = { ...currentMetadata, knowledgeBaseId: linkData.knowledgeBaseId };
      // @ts-ignore - PrismaClient models are not properly typed
      const updatedAgent = await this.prisma.agent.update({
        where: { id: linkData.assistantId },
        // @ts-ignore - Prisma client typings might be outdated; schema includes Agent.metadata Json
        data: { metadata: newMetadata },
      });
      
      this.logger.log(`Successfully linked KB to agent: ${JSON.stringify({ id: updatedAgent.id, metadata: updatedAgent.metadata })}`);

      return { 
        success: true, 
        message: 'Knowledge base linked to agent',
        agent: updatedAgent
      };
    } catch (error) {
      this.logger.error(`Failed to link knowledge base to assistant: ${error.message}`, error.stack);
      return { success: false, error: `Failed to link knowledge base to assistant: ${error.message}` };
    }
  }

  // Resolve workspace/org id from headers with a token fallback.
  private resolveOrgId(req: any): string {
    const orgId =
      req.headers['x-workspace-id'] ||
      req.headers['organization-id'] ||
      req.headers['x-force-organization-id'] ||
      req.user?.orgId;
    if (!orgId) throw new NotFoundException('Organization ID is required');
    return orgId;
  }

  // ---------------------------------------------------------------------------
  // PR-3: URL ingestion
  // ---------------------------------------------------------------------------

  @Post(':id/sources/url')
  @ApiOperation({ summary: 'Link one or more URLs as knowledge base sources' })
  @ApiParam({ name: 'id', description: 'Knowledge Base ID' })
  async linkUrlSources(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: LinkUrlSourceDto,
  ) {
    const orgId = dto.workspaceId || this.resolveOrgId(req);
    this.logger.log(`[linkUrlSources] Linking ${dto.urls?.length || 0} URL(s) to KB ${id} for org ${orgId}`);
    return this.knowledgeBaseService.linkUrlSources(id, dto, orgId);
  }

  // ---------------------------------------------------------------------------
  // PR-4: KB settings
  // ---------------------------------------------------------------------------

  @Get(':id/settings')
  @ApiOperation({ summary: 'Get knowledge base settings (embedding model + retrieval config)' })
  @ApiParam({ name: 'id', description: 'Knowledge Base ID' })
  async getSettings(@Req() req, @Param('id') id: string) {
    const orgId = this.resolveOrgId(req);
    return this.knowledgeBaseService.getKnowledgeBaseSettings(id, orgId);
  }

  @Patch(':id/settings')
  @ApiOperation({ summary: 'Update knowledge base settings' })
  @ApiParam({ name: 'id', description: 'Knowledge Base ID' })
  async updateSettings(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: KnowledgeBaseSettingsDto,
  ) {
    const orgId = dto.workspaceId || this.resolveOrgId(req);
    this.logger.log(`[updateSettings] Updating settings for KB ${id} in org ${orgId}`);
    return this.knowledgeBaseService.updateKnowledgeBaseSettings(id, dto, orgId);
  }

  // ---------------------------------------------------------------------------
  // PR-5: Chunk management + retrieval test
  // ---------------------------------------------------------------------------

  @Get(':id/chunks/browse')
  @ApiOperation({ summary: 'Browse chunks (paginated) for a knowledge base' })
  @ApiParam({ name: 'id', description: 'Knowledge Base ID' })
  async browseChunks(
    @Req() req,
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('sourceId') sourceId?: string,
  ) {
    const orgId = this.resolveOrgId(req);
    return this.knowledgeBaseService.listChunks(id, orgId, {
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      sourceId,
    });
  }

  @Get(':id/chunks/:chunkId')
  @ApiOperation({ summary: 'Get a single chunk with its full text' })
  @ApiParam({ name: 'id', description: 'Knowledge Base ID' })
  @ApiParam({ name: 'chunkId', description: 'Chunk metadata ID' })
  async getChunk(@Req() req, @Param('id') id: string, @Param('chunkId') chunkId: string) {
    const orgId = this.resolveOrgId(req);
    return this.knowledgeBaseService.getChunk(id, chunkId, orgId);
  }

  @Patch(':id/chunks/:chunkId')
  @ApiOperation({ summary: 'Edit a chunk (re-embeds it)' })
  @ApiParam({ name: 'id', description: 'Knowledge Base ID' })
  @ApiParam({ name: 'chunkId', description: 'Chunk metadata ID' })
  async updateChunk(
    @Req() req,
    @Param('id') id: string,
    @Param('chunkId') chunkId: string,
    @Body() dto: UpdateChunkDto,
  ) {
    const orgId = dto.workspaceId || this.resolveOrgId(req);
    return this.knowledgeBaseService.updateChunk(id, chunkId, dto.text, orgId);
  }

  @Delete(':id/chunks/:chunkId')
  @ApiOperation({ summary: 'Delete a chunk from Qdrant + Postgres' })
  @ApiParam({ name: 'id', description: 'Knowledge Base ID' })
  @ApiParam({ name: 'chunkId', description: 'Chunk metadata ID' })
  async deleteChunk(@Req() req, @Param('id') id: string, @Param('chunkId') chunkId: string) {
    const orgId = this.resolveOrgId(req);
    return this.knowledgeBaseService.deleteChunk(id, chunkId, orgId);
  }

  @Post(':id/retrieve')
  @ApiOperation({ summary: 'Run a real retrieval test against the knowledge base' })
  @ApiParam({ name: 'id', description: 'Knowledge Base ID' })
  async retrieveTest(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: RetrieveTestDto,
  ) {
    const orgId = dto.workspaceId || this.resolveOrgId(req);
    this.logger.log(`[retrieveTest] KB ${id} question: "${dto.question?.substring(0, 60)}"`);
    return this.knowledgeBaseService.retrieveTest(id, dto.question, orgId);
  }
} 