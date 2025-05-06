import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../../core/database/prisma.service';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge-base.dto';
import { UpdateKnowledgeBaseDto } from './dto/update-knowledge-base.dto';
import { JOB_NAMES } from '@jibu/queue-definitions';
import * as Redis from 'ioredis';

@Injectable()
export class KnowledgeBaseService {
  private readonly logger = new Logger(KnowledgeBaseService.name);
  private readonly redis: Redis.Redis;

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('indexing') private readonly indexingQueue: Queue,
  ) {
    // Initialize Redis client using environment variables for Docker compatibility
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
    const redisPassword = process.env.REDIS_PASSWORD || '';
    
    this.logger.log(`Initializing Redis connection to ${redisHost}:${redisPort} for direct queue integration`);
    
    this.redis = new Redis.default({
      host: redisHost,
      port: redisPort,
      password: redisPassword || undefined,
    });
    
    this.redis.on('connect', () => {
      this.logger.log('Redis client successfully connected for direct queue integration');
    });
    
    this.redis.on('error', (err) => {
      this.logger.error(`Redis connection error: ${err.message}`, err.stack);
    });
  }

  /**
   * Create a new knowledge base
   */
  async createKnowledgeBase(orgId: string, userId: string, dto: CreateKnowledgeBaseDto) {
    this.logger.log(`Creating knowledge base for org ${orgId}: ${dto.name}`);
    
    if (!orgId) {
      this.logger.error('Attempt to create knowledge base without organization ID');
      throw new Error('Organization ID is required to create a knowledge base');
    }
    
    // Check if organization exists, but don't fail if it doesn't exist in the database
    // This allows for organizations that might be managed in an external system
    try {
      // @ts-ignore - PrismaClient models are not properly typed in the service
      const organization = await this.prisma.organization.findUnique({
        where: { id: orgId }
      });
      
      if (!organization) {
        // Log a warning but continue - this is just to flag potential issues
        this.logger.warn(`Organization with ID ${orgId} not found in database, but will attempt to create knowledge base anyway`);
      } else {
        this.logger.log(`Organization found: ${organization.id} - ${organization.name || 'unnamed'}`);
      }
    } catch (error) {
      // Just log the error but don't stop the process
      this.logger.warn(`Error checking organization: ${error.message}`, error.stack);
    }
    
    // Explicitly set fields to ensure they're saved properly
    const data = {
        name: dto.name,
        organizationId: orgId,
      ...(dto.description && { description: dto.description })
    };
    
    this.logger.log(`KB data being sent to Prisma: ${JSON.stringify(data)}`);
    
    try {
      // Directly create the knowledge base with the exact data provided
      // @ts-ignore - PrismaClient models are not properly typed in the service
      const knowledgeBase = await this.prisma.knowledgeBase.create({
        data
      });
      
      if (!knowledgeBase || !knowledgeBase.id) {
        this.logger.error('Knowledge base creation returned invalid data');
        throw new Error('Knowledge base creation failed: Invalid data returned');
      }
      
      // Check if the returned knowledge base has the correct organization ID
      if (!knowledgeBase.organizationId) {
        this.logger.warn(`Knowledge base created without organizationId, adding: ${orgId}`);
        
        // Update the record with the correct organization ID
        try {
          // @ts-ignore - PrismaClient models are not properly typed in the service
          await this.prisma.knowledgeBase.update({
            where: { id: knowledgeBase.id },
            data: { organizationId: orgId }
          });
          this.logger.log(`Successfully added missing organization ID ${orgId} to knowledge base ${knowledgeBase.id}`);
        } catch (updateError) {
          this.logger.error(`Failed to update knowledge base with correct organization ID: ${updateError.message}`);
        }
        
        // Update the in-memory object for the return value
        knowledgeBase.organizationId = orgId;
      } else if (knowledgeBase.organizationId !== orgId) {
        this.logger.warn(`Knowledge base created with different organizationId (${knowledgeBase.organizationId}) than requested (${orgId}). Correcting...`);
        
        // Attempt to update the record with the correct organization ID
        try {
          // @ts-ignore - PrismaClient models are not properly typed in the service
          await this.prisma.knowledgeBase.update({
            where: { id: knowledgeBase.id },
            data: { organizationId: orgId }
          });
          this.logger.log(`Successfully updated knowledge base ${knowledgeBase.id} with correct organization ID ${orgId}`);
        } catch (updateError) {
          this.logger.error(`Failed to update knowledge base with correct organization ID: ${updateError.message}`);
        }
        
        // Update the in-memory object for the return value
        knowledgeBase.organizationId = orgId;
      }
      
      this.logger.log(`Created knowledge base: ${JSON.stringify({
        id: knowledgeBase.id,
        name: knowledgeBase.name,
        organizationId: knowledgeBase.organizationId
      })}`);
      
    return knowledgeBase;
    } catch (error) {
      this.logger.error(`Error creating knowledge base: ${error.message}`, error.stack);
      
      // Check for duplicate name constraint if that's a restriction
      if (error.message?.includes('Unique constraint failed')) {
        throw new Error(`A knowledge base with the name "${dto.name}" already exists`);
      }
      
      throw error;
    }
  }

  /**
   * Find a knowledge base by ID
   */
  async findKnowledgeBaseById(knowledgeBaseId: string, orgId: string) {
    this.logger.log(`Finding knowledge base with ID ${knowledgeBaseId} for organization ${orgId}`);
    
    // First check if the knowledge base exists at all, regardless of organization
    // @ts-ignore - PrismaClient models are not properly typed in the service
    const anyKnowledgeBase = await this.prisma.knowledgeBase.findUnique({
      where: {
        id: knowledgeBaseId,
      },
    });

    if (!anyKnowledgeBase) {
      this.logger.error(`Knowledge base with ID ${knowledgeBaseId} not found in any organization`);
      throw new NotFoundException(`Knowledge base with ID ${knowledgeBaseId} not found`);
    }

    // If it exists but belongs to another organization
    if (anyKnowledgeBase.organizationId !== orgId) {
      this.logger.error(`Knowledge base ${knowledgeBaseId} found but belongs to organization ${anyKnowledgeBase.organizationId}, not ${orgId}`);
      throw new NotFoundException(`Knowledge base with ID ${knowledgeBaseId} not found for organization ${orgId}`);
    }

    return anyKnowledgeBase;
  }

  /**
   * List all knowledge bases for an organization
   */
  async listKnowledgeBasesForOrg(orgId: string) {
    // @ts-ignore - PrismaClient models are not properly typed in the service
    return this.prisma.knowledgeBase.findMany({
      where: {
        organizationId: orgId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Update a knowledge base
   */
  async updateKnowledgeBase(knowledgeBaseId: string, orgId: string, dto: UpdateKnowledgeBaseDto) {
    // Verify existence first
    await this.findKnowledgeBaseById(knowledgeBaseId, orgId);
    
    this.logger.log(`Updating knowledge base ${knowledgeBaseId}`);
    
    // @ts-ignore - PrismaClient models are not properly typed in the service
    return this.prisma.knowledgeBase.update({
      where: {
        id: knowledgeBaseId,
      },
      data: {
        ...(dto.name && { name: dto.name }),
      },
    });
  }

  /**
   * Delete a knowledge base
   */
  async deleteKnowledgeBase(knowledgeBaseId: string, orgId: string) {
    // Verify existence first
    await this.findKnowledgeBaseById(knowledgeBaseId, orgId);
    
    // Get all sources to trigger de-indexing
    // @ts-ignore - PrismaClient models are not properly typed in the service
    const sources = await this.prisma.knowledgeBaseSource.findMany({
      where: {
        knowledgeBaseId,
        organizationId: orgId,
      },
    });
    
    // Trigger de-indexing for all sources
    for (const source of sources) {
      try {
        await this.indexingQueue.add(JOB_NAMES.DEINDEX_SOURCE, {
          knowledgeBaseSourceId: source.id,
          organizationId: orgId,
          sourceType: source.sourceType,
          sourcePointer: source.sourcePointer,
        });
      } catch (error) {
        this.logger.error(`Failed to add de-indexing job for source ${source.id}`, error);
        // Continue with other sources even if one fails
      }
    }
    
    this.logger.log(`Deleting knowledge base ${knowledgeBaseId}`);
    
    // Delete the knowledge base (will cascade delete sources)
    // @ts-ignore - PrismaClient models are not properly typed in the service
    return this.prisma.knowledgeBase.delete({
      where: {
        id: knowledgeBaseId,
      },
    });
  }

  /**
   * Link a file as a source to a knowledge base
   */
  async linkFileSource(knowledgeBaseId: string, fileId: string, orgId: string, userId: string) {
    try {
      // First check if the knowledge base exists at all, regardless of organization
      // @ts-ignore - PrismaClient models are not properly typed in the service
      const anyKnowledgeBase = await this.prisma.knowledgeBase.findUnique({
        where: { id: knowledgeBaseId },
      });
      
      if (!anyKnowledgeBase) {
        this.logger.error(`Knowledge base with ID ${knowledgeBaseId} not found in any organization`);
        throw new NotFoundException(`Knowledge base with ID ${knowledgeBaseId} not found`);
      }
      
      // If it exists but belongs to another organization, warn but proceed
      if (anyKnowledgeBase.organizationId !== orgId) {
        this.logger.warn(`Knowledge base ${knowledgeBaseId} found but belongs to organization ${anyKnowledgeBase.organizationId}, not ${orgId}. Continuing with requested organization ID.`);
        // We'll continue with the requested organization ID
      }
      
      this.logger.log(`Attempting to find file with ID ${fileId} for org ${orgId}`);
    
    // Verify File exists and belongs to the organization
      // Debug the query parameters
      this.logger.log(`File search query params: ${JSON.stringify({
        id: fileId,
        organizationId: orgId
      })}`);
      
      // @ts-ignore - PrismaClient models are not properly typed in the service
    const file = await this.prisma.file.findFirst({
      where: {
        id: fileId,
        organizationId: orgId,
      },
        select: {
          id: true,
          name: true,
          mimeType: true,
          sizeBytes: true,
          createdAt: true
        }
    });
    
    if (!file) {
        this.logger.warn(`File with ID ${fileId} not found for organization ${orgId}`);
      throw new NotFoundException(`File with ID ${fileId} not found`);
    }
    
      this.logger.log(`Found file: ${JSON.stringify(file)}`);
      
      // Create a source entry for the file
      const source = await this.createSourceForFile(knowledgeBaseId, orgId, file);
      
      this.logger.log(`Created source: ${JSON.stringify(source)}`);
      
      // Return the created source
      return source;
    } catch (error) {
      this.logger.error(`Error linking file source: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Helper to create a source for a file
   */
  private async createSourceForFile(knowledgeBaseId: string, orgId: string, file: any) {
    try {
      this.logger.log(`Creating source for file ${file.id} in knowledge base ${knowledgeBaseId}`);
      
      // Create or find the source
      // @ts-ignore - PrismaClient models are not properly typed
      const source = await this.prisma.knowledgeBaseSource.create({
        data: {
          knowledgeBaseId,
          sourceType: 'file',
          sourcePointer: file.id,
          organizationId: orgId,
          indexingStatus: 'PENDING',
        },
      });

      this.logger.log(`Created source: ${source.id}`);

      // Add file to the indexing queue using direct Redis publish
      try {
        this.logger.log(`Publishing source ${source.id} to Redis indexing channel`);
        
        // Create a payload matching the format worker.js expects
        const payload = JSON.stringify({
          sourceId: source.id,
          knowledgeBaseId,
          organizationId: orgId,
        });
        
        // Publish to the Redis channel that the worker listens on
        const result = await this.redis.publish('kb:indexing:requests', payload);
        
        if (result > 0) {
          this.logger.log(`Successfully published indexing request for source ${source.id} (${result} subscribers)`);
        } else {
          this.logger.warn(`Published indexing request, but no subscribers were listening (${result} subscribers)`);
        }

        // Update the source to show it's been queued
        // @ts-ignore - PrismaClient models are not properly typed
        await this.prisma.knowledgeBaseSource.update({
          where: { id: source.id },
          data: { indexingStatus: 'PROCESSING' },
        });
      } catch (queueError) {
        this.logger.error(`Failed to queue indexing job: ${queueError.message}`, queueError.stack);
        // Continue with the process even if queueing fails
        // We don't want to break the file linkage just because indexing couldn't start
      }

      return source;
    } catch (error) {
      this.logger.error(`Error creating source for file: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Unlink a source from a knowledge base
   */
  async unlinkFileSource(sourceId: string, orgId: string, userId: string) {
    // Find the source
    // @ts-ignore - PrismaClient models are not properly typed in the service
    const source = await this.prisma.knowledgeBaseSource.findFirst({
      where: {
        id: sourceId,
        organizationId: orgId,
      },
    });
    
    if (!source) {
      throw new NotFoundException(`Source with ID ${sourceId} not found`);
    }
    
    this.logger.log(`Unlinking source ${sourceId} from knowledge base ${source.knowledgeBaseId}`);
    
    // Add de-indexing job
    try {
      await this.indexingQueue.add(JOB_NAMES.DEINDEX_SOURCE, {
        knowledgeBaseSourceId: sourceId,
        organizationId: orgId,
        sourceType: source.sourceType,
        sourcePointer: source.sourcePointer,
      });
      this.logger.log(`Added de-indexing job for source ${sourceId}`);
    } catch (error) {
      this.logger.error(`Failed to add de-indexing job for source ${sourceId}`, error);
      // Don't rethrow - we still want to delete the source
    }
    
    // Delete the source
    // @ts-ignore - PrismaClient models are not properly typed in the service
    return this.prisma.knowledgeBaseSource.delete({
      where: {
        id: sourceId,
      },
    });
  }

  /**
   * List all sources for a knowledge base
   */
  async listSourcesForKb(knowledgeBaseId: string, orgId: string) {
    // Verify KB exists
    await this.findKnowledgeBaseById(knowledgeBaseId, orgId);
    
    // @ts-ignore - PrismaClient models are not properly typed in the service
    return this.prisma.knowledgeBaseSource.findMany({
      where: {
        knowledgeBaseId,
        organizationId: orgId,
      },
      include: {
        file: {
          select: {
            id: true,
            name: true,
            mimeType: true,
            sizeBytes: true,
          }
        }
      }
    });
  }

  /**
   * Trigger indexing for a source
   */
  async triggerSourceIndexing(
    sourceId: string,
    knowledgeBaseId: string,
    orgId: string
  ) {
    // First get the source to make sure it exists
    // @ts-ignore - PrismaClient models are not properly typed in the service
    const source = await this.prisma.knowledgeBaseSource.findFirst({
      where: {
        id: sourceId,
        knowledgeBaseId,
        organizationId: orgId,
      },
    });
    
    if (!source) {
      throw new NotFoundException(`Source with ID ${sourceId} not found`);
    }
    
    // Publish to Redis channel instead of using Bull
    const payload = JSON.stringify({
      sourceId: sourceId,
      knowledgeBaseId: knowledgeBaseId,
      organizationId: orgId,
    });
    
    await this.redis.publish('kb:indexing:requests', payload);
    
    this.logger.log(`Published indexing request for source ${sourceId}`);
    return { success: true };
  }

  /**
   * List all knowledge bases across all organizations
   */
  async listAllKnowledgeBases() {
    this.logger.log('Retrieving all knowledge bases across all organizations');
    
    // @ts-ignore - PrismaClient models are not properly typed in the service
    return this.prisma.knowledgeBase.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
} 