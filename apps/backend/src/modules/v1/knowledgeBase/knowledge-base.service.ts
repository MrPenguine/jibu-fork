import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../../core/database/prisma.service';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge-base.dto';
import { UpdateKnowledgeBaseDto } from './dto/update-knowledge-base.dto';
import { JOB_NAMES } from '@jibu/queue-definitions';

// Supported knowledge-base file types (kept in sync with the worker extractor + UI dropzone).
const SUPPORTED_EXTENSIONS = ['pdf', 'txt', 'md', 'markdown', 'csv', 'tsv', 'docx', 'json', 'log'];
const SUPPORTED_MIME_HINTS = [
  'pdf',
  'text/',
  'markdown',
  'csv',
  'json',
  'officedocument.wordprocessingml',
  'msword',
];

function isSupportedFileType(mimeType?: string, fileName?: string): boolean {
  const mime = (mimeType || '').toLowerCase();
  const ext = (fileName?.split('.').pop() || '').toLowerCase();
  if (SUPPORTED_MIME_HINTS.some((h) => mime.includes(h))) return true;
  if (SUPPORTED_EXTENSIONS.includes(ext)) return true;
  return false;
}

const VALID_CHUNK_STRATEGIES = ['clean_html', 'summarize', 'smart', 'headers', 'faq'];
const DEFAULT_CHUNK_SIZE = 1000;
const DEFAULT_CHUNK_OVERLAP = 200;

export interface ChunkConfigInput {
  strategies?: string[];
  chunkSize?: number;
  chunkOverlap?: number;
}

/**
 * Normalize raw chunk config into a persisted shape with sane defaults.
 * Accepts strategies as an array or a comma-joined string, filters to known
 * strategies, and clamps size/overlap.
 */
function normalizeChunkConfig(input?: ChunkConfigInput) {
  const rawStrategies = Array.isArray(input?.strategies)
    ? input!.strategies
    : typeof (input as any)?.strategies === 'string'
      ? String((input as any).strategies).split(',')
      : [];

  const strategies = rawStrategies
    .map((s) => String(s).trim().toLowerCase())
    .filter((s) => VALID_CHUNK_STRATEGIES.includes(s));

  const chunkSize =
    typeof input?.chunkSize === 'number' && input.chunkSize > 0
      ? Math.min(Math.max(Math.round(input.chunkSize), 100), 8000)
      : DEFAULT_CHUNK_SIZE;

  const chunkOverlap =
    typeof input?.chunkOverlap === 'number' && input.chunkOverlap >= 0
      ? Math.min(Math.max(Math.round(input.chunkOverlap), 0), 2000)
      : DEFAULT_CHUNK_OVERLAP;

  return {
    // de-dupe while preserving first occurrence
    strategies: [...new Set(strategies)],
    chunkSize,
    chunkOverlap: Math.min(chunkOverlap, chunkSize - 1),
  };
}

@Injectable()
export class KnowledgeBaseService {
  private readonly logger = new Logger(KnowledgeBaseService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('indexing') private readonly indexingQueue: Queue,
  ) {}

  /**
   * Create a new knowledge base
   */
  async createKnowledgeBase(workspaceId: string, userId: string, dto: CreateKnowledgeBaseDto) {
    this.logger.log(`Creating knowledge base for workspace ${workspaceId}: ${dto.name}`);

    if (!workspaceId) {
      this.logger.error('Attempt to create knowledge base without workspace ID');
      throw new Error('Workspace ID is required to create a knowledge base');
    }

    const data = {
      name: dto.name,
      workspaceId: workspaceId,
      ...(dto.description && { description: dto.description }),
    };

    this.logger.log(`KB data being sent to Prisma: ${JSON.stringify(data)}`);

    try {
      const knowledgeBase = await this.prisma.knowledgeBase.create({
        data,
      });

      if (!knowledgeBase || !knowledgeBase.id) {
        this.logger.error('Knowledge base creation returned invalid data');
        throw new Error('Knowledge base creation failed: Invalid data returned');
      }

      this.logger.log(`Created knowledge base: ${JSON.stringify({
        id: knowledgeBase.id,
        name: knowledgeBase.name,
        workspaceId: knowledgeBase.workspaceId,
      })}`);

      return knowledgeBase;
    } catch (error) {
      this.logger.error(`Error creating knowledge base: ${error.message}`, error.stack);

      if (error.message?.includes('Unique constraint failed')) {
        throw new Error(`A knowledge base with the name "${dto.name}" already exists`);
      }

      throw error;
    }
  }

  /**
   * Find a knowledge base by ID
   */
  async findKnowledgeBaseById(knowledgeBaseId: string, workspaceId: string) {
    this.logger.log(`Finding knowledge base with ID ${knowledgeBaseId} for workspace ${workspaceId}`);

    const knowledgeBase = await this.prisma.knowledgeBase.findFirst({
      where: {
        id: knowledgeBaseId,
        workspaceId: workspaceId,
      },
    });

    if (!knowledgeBase) {
      this.logger.error(`Knowledge base with ID ${knowledgeBaseId} not found in workspace ${workspaceId}`);
      throw new NotFoundException(`Knowledge base with ID ${knowledgeBaseId} not found`);
    }

    return knowledgeBase;
  }

  /**
   * List all knowledge bases for a workspace
   */
  async listKnowledgeBasesForWorkspace(workspaceId: string) {
    return this.prisma.knowledgeBase.findMany({
      where: {
        workspaceId: workspaceId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Update a knowledge base
   */
  async updateKnowledgeBase(knowledgeBaseId: string, workspaceId: string, dto: UpdateKnowledgeBaseDto) {
    await this.findKnowledgeBaseById(knowledgeBaseId, workspaceId);

    this.logger.log(`Updating knowledge base ${knowledgeBaseId}`);

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
  async deleteKnowledgeBase(knowledgeBaseId: string, workspaceId: string) {
    await this.findKnowledgeBaseById(knowledgeBaseId, workspaceId);

    const sources = await this.prisma.knowledgeBaseSource.findMany({
      where: {
        knowledgeBaseId,
        workspaceId: workspaceId,
      },
    });

    for (const source of sources) {
      try {
        await this.indexingQueue.add(JOB_NAMES.DEINDEX_SOURCE, {
          knowledgeBaseSourceId: source.id,
          workspaceId: workspaceId,
          sourceType: source.sourceType,
          sourcePointer: source.sourcePointer,
          knowledgeBaseId: knowledgeBaseId,
        });
      } catch (error) {
        this.logger.error(`Failed to add de-indexing job for source ${source.id}`, error);
      }
    }

    this.logger.log(`Deleting knowledge base ${knowledgeBaseId}`);

    return this.prisma.knowledgeBase.delete({
      where: {
        id: knowledgeBaseId,
      },
    });
  }

  /**
   * Link a file as a source to a knowledge base
   */
  async linkFileSource(knowledgeBaseId: string, fileId: string, workspaceId: string, userId: string, folderId?: string, chunkConfig?: ChunkConfigInput) {
    try {
      await this.findKnowledgeBaseById(knowledgeBaseId, workspaceId);

      this.logger.log(`Attempting to find file with ID ${fileId} for workspace ${workspaceId}`);

      const file = await this.prisma.file.findFirst({
        where: {
          id: fileId,
          workspaceId: workspaceId,
        },
        select: {
          id: true,
          name: true,
          mimeType: true,
          sizeBytes: true,
          createdAt: true,
        },
      });

      if (!file) {
        this.logger.warn(`File with ID ${fileId} not found for workspace ${workspaceId}`);
        throw new NotFoundException(`File with ID ${fileId} not found`);
      }

      if (!isSupportedFileType(file.mimeType, file.name)) {
        this.logger.warn(`Rejected unsupported file type for ${file.name} (${file.mimeType})`);
        throw new BadRequestException(
          `Unsupported file type "${file.mimeType || file.name}". Supported types: pdf, txt, md, csv, docx.`,
        );
      }

      this.logger.log(`Found file: ${JSON.stringify(file)}`);

      // Optional folder validation
      if (folderId) {
        const folder = await this.prisma.folder.findFirst({
          where: { id: folderId, workspaceId },
        });
        if (!folder) {
          this.logger.warn(`Folder with ID ${folderId} not found for workspace ${workspaceId}`);
          throw new NotFoundException(`Folder ${folderId} not found`);
        }
      }

      const source = await this.createSourceForFile(knowledgeBaseId, workspaceId, file, folderId, chunkConfig);

      this.logger.log(`Created source: ${JSON.stringify(source)}`);

      return source;
    } catch (error) {
      this.logger.error(`Error linking file source: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Helper to create a source for a file
   */
  private async createSourceForFile(knowledgeBaseId: string, workspaceId: string, file: any, folderId?: string, chunkConfig?: ChunkConfigInput) {
    try {
      this.logger.log(`Creating source for file ${file.id} in knowledge base ${knowledgeBaseId}`);

      const normalizedChunkConfig = normalizeChunkConfig(chunkConfig);
      this.logger.log(`Chunk config for source: ${JSON.stringify(normalizedChunkConfig)}`);

      const source = await this.prisma.knowledgeBaseSource.create({
        data: {
          knowledgeBaseId,
          sourceType: 'file',
          sourcePointer: file.id,
          workspaceId: workspaceId,
          indexingStatus: 'PENDING',
          chunkConfig: normalizedChunkConfig,
          ...(folderId && { folderId }),
        },
      });

      this.logger.log(`Created source: ${source.id}`);

      try {
        this.logger.log(`Adding source ${source.id} to Bull indexing queue`);

        await this.indexingQueue.add(JOB_NAMES.INDEX_FILE_SOURCE, {
          knowledgeBaseSourceId: source.id,
          workspaceId: workspaceId,
          chunkConfig: normalizedChunkConfig,
        });

        this.logger.log(`Successfully added indexing job for source ${source.id} to Bull queue`);

        await this.prisma.knowledgeBaseSource.update({
          where: { id: source.id },
          data: { indexingStatus: 'PROCESSING' },
        });
      } catch (queueError) {
        this.logger.error(`Failed to queue indexing job: ${queueError.message}`, queueError.stack);
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
  async unlinkFileSource(sourceId: string, workspaceId: string, userId: string) {
    const source = await this.prisma.knowledgeBaseSource.findFirst({
      where: {
        id: sourceId,
        workspaceId: workspaceId,
      },
    });

    if (!source) {
      throw new NotFoundException(`Source with ID ${sourceId} not found`);
    }

    this.logger.log(`Unlinking source ${sourceId} from knowledge base ${source.knowledgeBaseId}`);

    try {
      const jobData = {
        knowledgeBaseSourceId: sourceId,
        workspaceId: workspaceId,
        sourceType: source.sourceType,
        sourcePointer: source.sourcePointer,
        knowledgeBaseId: source.knowledgeBaseId,
      };

      this.logger.log(`Adding de-indexing job with data: ${JSON.stringify(jobData)}`);

      const job = await this.indexingQueue.add(JOB_NAMES.DEINDEX_SOURCE, jobData);

      this.logger.log(`Added de-indexing job for source ${sourceId}, job ID: ${job.id}`);
    } catch (error) {
      this.logger.error(`Failed to add de-indexing job for source ${sourceId}: ${error.message}`, error.stack);
    }

    return this.prisma.knowledgeBaseSource.delete({
      where: {
        id: sourceId,
      },
    });
  }

  /**
   * List all sources for a knowledge base
   */
  async listSourcesForKb(knowledgeBaseId: string, workspaceId: string) {
    await this.findKnowledgeBaseById(knowledgeBaseId, workspaceId);

    return this.prisma.knowledgeBaseSource.findMany({
      where: {
        knowledgeBaseId,
        workspaceId: workspaceId,
      },
      include: {
        file: {
          select: {
            id: true,
            name: true,
            mimeType: true,
            sizeBytes: true,
          },
        },
        folder: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Trigger indexing for a source
   */
  async triggerSourceIndexing(
    sourceId: string,
    knowledgeBaseId: string,
    workspaceId: string
  ) {
    const source = await this.prisma.knowledgeBaseSource.findFirst({
      where: {
        id: sourceId,
        knowledgeBaseId,
        workspaceId: workspaceId,
      },
    });

    if (!source) {
      throw new NotFoundException(`Source with ID ${sourceId} not found`);
    }

    await this.indexingQueue.add(JOB_NAMES.INDEX_FILE_SOURCE, {
      knowledgeBaseSourceId: sourceId,
      workspaceId: workspaceId,
    });

    this.logger.log(`Added indexing job for source ${sourceId} to queue`);

    await this.prisma.knowledgeBaseSource.update({
      where: { id: source.id },
      data: { indexingStatus: 'PROCESSING' },
    });

    return { success: true };
  }

  /**
   * List all knowledge bases across all workspaces
   */
  async listAllKnowledgeBases() {
    this.logger.log('Retrieving all knowledge bases across all workspaces');

    return this.prisma.knowledgeBase.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Get all chunks for a knowledge base
   */
  async getKnowledgeBaseChunks(knowledgeBaseId: string, workspaceId: string) {
    await this.findKnowledgeBaseById(knowledgeBaseId, workspaceId);

    this.logger.log(`Getting chunks for knowledge base: ${knowledgeBaseId}`);

    return this.prisma.chunkMetadata.findMany({
      where: {
        knowledgeBaseId,
      },
      orderBy: [{ sourceId: 'asc' }, { chunkIndex: 'asc' }],
      include: {
        source: {
          select: {
            id: true,
            file: {
              select: {
                id: true,
                name: true,
                mimeType: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Get chunks for a specific source in a knowledge base
   */
  async getSourceChunks(knowledgeBaseId: string, sourceId: string, workspaceId: string) {
    await this.findKnowledgeBaseById(knowledgeBaseId, workspaceId);

    const source = await this.prisma.knowledgeBaseSource.findFirst({
      where: {
        id: sourceId,
        knowledgeBaseId,
        workspaceId: workspaceId,
      },
    });

    if (!source) {
      throw new NotFoundException(`Source ${sourceId} not found in knowledge base ${knowledgeBaseId}`);
    }

    this.logger.log(`Getting chunks for source: ${sourceId} in knowledge base: ${knowledgeBaseId}`);

    return this.prisma.chunkMetadata.findMany({
      where: {
        sourceId,
        knowledgeBaseId,
      },
      orderBy: {
        chunkIndex: 'asc',
      },
    });
  }

  /**
   * Get statistics about chunks in a knowledge base
   */
  async getKnowledgeBaseChunkStats(knowledgeBaseId: string, workspaceId: string) {
    await this.findKnowledgeBaseById(knowledgeBaseId, workspaceId);

    this.logger.log(`Getting chunk statistics for knowledge base: ${knowledgeBaseId}`);

    const sources = await this.prisma.knowledgeBaseSource.findMany({
      where: {
        knowledgeBaseId,
        hasIndexedContent: true,
      },
      include: {
        file: {
          select: {
            name: true,
            mimeType: true,
            sizeBytes: true,
          },
        },
      },
    });

    const chunkCount = await this.prisma.chunkMetadata.count({
      where: {
        knowledgeBaseId,
      },
    });

    const aggregations = await this.prisma.chunkMetadata.aggregate({
      where: {
        knowledgeBaseId,
      },
      _sum: {
        textLength: true,
      },
    });

    const totalTextLength = aggregations._sum.textLength || 0;

    const sourceStats = await Promise.all(
      sources.map(async (source) => {
        const sourceChunkCount = await this.prisma.chunkMetadata.count({
          where: {
            sourceId: source.id,
          },
        });

        const sourceFile = (source as any).file;

        return {
          sourceId: source.id,
          fileName: sourceFile?.name || 'Unknown',
          mimeType: sourceFile?.mimeType || 'Unknown',
          fileSizeBytes: sourceFile?.sizeBytes || 0,
          chunkCount: sourceChunkCount,
          indexingStatus: source.indexingStatus,
        };
      }),
    );

    return {
      knowledgeBaseId,
      totalSources: sources.length,
      totalChunks: chunkCount,
      totalTextLength,
      averageChunkLength: chunkCount > 0 ? Math.round(totalTextLength / chunkCount) : 0,
      sources: sourceStats,
    };
  }
}