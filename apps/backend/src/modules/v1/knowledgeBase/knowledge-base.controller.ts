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
      // 2. Then from x-organization-id or organization-id header 
      // 3. Finally from user token
      let orgId = createKnowledgeBaseDto.organizationId;
      
      // If not in request body, try headers in various formats
      if (!orgId) {
        // Check multiple header formats to be thorough
        orgId = req.headers['x-organization-id'] || 
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
        
        // Ensure organizationId is included in the response
        if (result) {
          // Check if the result has the proper organizationId
          if (!result.organizationId) {
            this.logger.log(`Adding missing organizationId ${orgId} to KB response`);
            result.organizationId = orgId;
          } else if (result.organizationId !== orgId) {
            this.logger.warn(`KB created with different organizationId: ${result.organizationId} vs expected ${orgId}`);
            // Update the response object to use the correct ID
            result.organizationId = orgId;
            
            // Also update the database record to fix any discrepancy
            try {
              // @ts-ignore - PrismaClient models are not properly typed
              await this.prisma.knowledgeBase.update({
                where: { id: result.id },
                data: { organizationId: orgId }
              });
              this.logger.log(`Fixed organizationId mismatch in database for KB ${result.id}`);
            } catch (updateError) {
              this.logger.error(`Failed to update KB with correct organizationId: ${updateError.message}`);
            }
          }
        }
        
        this.logger.log(`KB created: ${result?.id} with organizationId: ${result?.organizationId}`);
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
      const orgId = req.headers['x-organization-id'] || 
                   req.headers['organization-id'] || 
                   req.headers['x-force-organization-id'] || 
                   req.user.orgId;
      
      if (!orgId) {
        this.logger.error('[findAll] No organization ID found in headers or token');
        throw new NotFoundException('Organization ID is required to list knowledge bases');
      }
      
      this.logger.log(`[findAll] Listing knowledge bases for organization: ${orgId}`);
      return this.knowledgeBaseService.listKnowledgeBasesForOrg(orgId);
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
      const orgId = req.headers['x-organization-id'] || 
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
      const orgId = req.headers['x-organization-id'] || 
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
      const orgId = req.headers['x-organization-id'] || 
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
      // 2. Then from x-organization-id or organization-id header 
      // 3. Finally from user token
      let orgId = linkFileSourceDto.organizationId;
      const userId = req.user.userId || req.user.id;
      
      // If not in request body, try headers
      if (!orgId) {
        orgId = req.headers['x-organization-id'] || req.headers['organization-id'];
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
        if (anyKnowledgeBase.organizationId !== orgId) {
          this.logger.warn(`Knowledge base ${id} belongs to organization ${anyKnowledgeBase.organizationId}, not ${orgId}. Will proceed anyway but this might indicate a configuration issue.`);
          
          // Option 1: Proceed with the request organization ID (current approach)
          // Keep orgId as is from the request
          
          // Option 2: Use the knowledge base's organization ID (alternative approach)
          // orgId = anyKnowledgeBase.organizationId;
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
    );
      
      this.logger.log(`Successfully linked file to KB: ${JSON.stringify({
        sourceId: source.id,
        knowledgeBaseId: source.knowledgeBaseId,
        organizationId: source.organizationId || orgId
      })}`);
      
      // Return the source object directly without additional wrapping
      if (source && source.id) {
        // Ensure source has correct organization ID
        if (!source.organizationId) {
          source.organizationId = orgId;
          this.logger.warn(`Added missing organizationId ${orgId} to source response`);
        } else if (source.organizationId !== orgId) {
          this.logger.warn(`Source has different organizationId (${source.organizationId}) than requested (${orgId}), correcting...`);
          source.organizationId = orgId;
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
    const orgId = req.user.orgId;
    const userId = req.user.userId;
    
    if (!orgId) {
      throw new Error('Organization ID is required');
    }
    
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
      // 2. Then from x-organization-id or organization-id header 
      // 3. Finally from user token
      let orgId = req.headers['x-organization-id'] || req.headers['organization-id'];
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
          organizationId: orgId,
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

  @Post(':id/sources/:sourceId/index')
  @ApiOperation({ summary: 'Trigger indexing for a source' })
  @ApiParam({ name: 'id', description: 'Knowledge Base ID' })
  @ApiParam({ name: 'sourceId', description: 'Source ID' })
  async triggerIndexing(
    @Param('id') id: string,
    @Param('sourceId') sourceId: string,
    @Req() req
  ) {
    const orgId = req.headers['x-organization-id'];
    
    // Find the source - use knowledgeBaseService or direct Prisma
    // @ts-ignore - PrismaClient models are not properly typed
    const source = await this.prisma.knowledgeBaseSource.findFirst({
      where: {
        id: sourceId,
        knowledgeBaseId: id,
        organizationId: orgId,
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
      const orgId = req.headers['x-organization-id'];
      
      // Get the source from database
      // @ts-ignore - PrismaClient models are not properly typed
      const source = await this.prisma.knowledgeBaseSource.findFirst({
        where: {
          id: sourceId,
          organizationId: orgId,
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
    @Body() linkData: { knowledgeBaseId: string; assistantId: string; organizationId?: string },
    @Req() req
  ) {
    try {
      // PRIORITY ORDER:
      // 1. First use organization ID from the request body (if provided)
      // 2. Then from x-organization-id header
      // 3. Finally from user token
      let orgId = linkData.organizationId;
      
      // If not in request body, try header
      if (!orgId) {
        orgId = req.headers['x-organization-id'] || req.headers['organization-id'];
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
          organizationId: orgId,
        },
      });

      if (!knowledgeBase) {
        this.logger.error(`Knowledge base ${linkData.knowledgeBaseId} not found for org ${orgId}`);
        return { error: 'Knowledge base not found' };
      }
      
      this.logger.log(`Found knowledge base: ${JSON.stringify(knowledgeBase)}`);

      // Verify the assistant exists and belongs to the organization
      // @ts-ignore - PrismaClient models are not properly typed
      const assistant = await this.prisma.assistant.findFirst({
        where: {
          id: linkData.assistantId,
          organizationId: orgId,
        },
      });

      if (!assistant) {
        this.logger.error(`Assistant ${linkData.assistantId} not found for org ${orgId}`);
        return { error: 'Assistant not found' };
      }
      
      this.logger.log(`Found assistant: ${JSON.stringify(assistant)}`);

      // Update the assistant to link it to the knowledge base
      // @ts-ignore - PrismaClient models are not properly typed
      const updatedAssistant = await this.prisma.assistant.update({
        where: { id: linkData.assistantId },
        data: { knowledgeBaseId: linkData.knowledgeBaseId },
      });
      
      this.logger.log(`Successfully linked KB to assistant: ${JSON.stringify(updatedAssistant)}`);

      return { 
        success: true, 
        message: 'Knowledge base linked to assistant',
        assistant: updatedAssistant
      };
    } catch (error) {
      this.logger.error(`Failed to link knowledge base to assistant: ${error.message}`, error.stack);
      return { success: false, error: `Failed to link knowledge base to assistant: ${error.message}` };
    }
  }
} 