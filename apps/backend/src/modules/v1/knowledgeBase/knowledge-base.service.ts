import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaService } from '../../../core/database/prisma.service';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge-base.dto';
import { UpdateKnowledgeBaseDto } from './dto/update-knowledge-base.dto';
import { LinkUrlSourceDto, REFRESH_RATES, RefreshRate } from './dto/link-url-source.dto';
import { KnowledgeBaseSettingsDto } from './dto/knowledge-base-settings.dto';
import { JOB_NAMES } from '@jibu/queue-definitions';
import { RagService } from '../../../integrations/agent/providers/langchain/rag.service';
import { VectorDbService } from '../../../../../worker/src/vector-db/vector-db.service';
import {
  EMBEDDING_MODELS as EMBEDDING_MODEL_REGISTRY,
  DEFAULT_EMBEDDING_MODEL,
} from '../../../../../worker/src/embedding/embedding.service';

// Cron expressions for repeatable URL refresh jobs.
const REFRESH_CRON: Record<Exclude<RefreshRate, 'never'>, string> = {
  daily: '0 3 * * *',
  weekly: '0 3 * * 0',
  monthly: '0 3 1 * *',
};

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

  private readonly genAI: GoogleGenerativeAI | null;

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('indexing') private readonly indexingQueue: Queue,
    private readonly ragService: RagService,
    private readonly vectorDb: VectorDbService,
    private readonly configService: ConfigService,
  ) {
    const geminiKey = this.configService.get<string>('GEMINI_API_KEY');
    this.genAI = geminiKey ? new GoogleGenerativeAI(geminiKey) : null;
  }

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

      // Clean up any repeatable refresh job for url/sitemap sources.
      await this.removeUrlRefresh(sourceId, (source as any).refreshInterval);
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

  // ===========================================================================
  // PR-3: URL ingestion + refresh scheduling
  // ===========================================================================

  /**
   * Link one or more URLs as sources. Each URL becomes a `url` source that the
   * worker fetches, strips to text, chunks and embeds. If a refresh rate is set,
   * a repeatable Bull job re-indexes the URL on the given cadence.
   */
  async linkUrlSources(
    knowledgeBaseId: string,
    dto: LinkUrlSourceDto,
    workspaceId: string,
  ) {
    await this.findKnowledgeBaseById(knowledgeBaseId, workspaceId);

    const urls = (dto.urls || [])
      .map((u) => (u || '').trim())
      .filter((u) => u.length > 0);

    if (urls.length === 0) {
      throw new BadRequestException('At least one URL is required');
    }

    for (const url of urls) {
      if (!/^https?:\/\//i.test(url)) {
        throw new BadRequestException(`Invalid URL "${url}". URLs must start with http:// or https://`);
      }
    }

    const refreshRate: RefreshRate =
      dto.refreshRate && REFRESH_RATES.includes(dto.refreshRate) ? dto.refreshRate : 'never';

    const normalizedChunkConfig = normalizeChunkConfig({
      strategies: dto.chunkingStrategy,
      chunkSize: dto.chunkSize,
      chunkOverlap: dto.chunkOverlap,
    });

    const created = [];
    for (const url of urls) {
      const source = await this.prisma.knowledgeBaseSource.create({
        data: {
          knowledgeBaseId,
          sourceType: 'url',
          sourceUrl: url,
          title: url,
          workspaceId,
          indexingStatus: 'PENDING',
          refreshInterval: refreshRate,
          chunkConfig: normalizedChunkConfig,
          ...(dto.folderId && { folderId: dto.folderId }),
        } as any,
      });

      try {
        await this.indexingQueue.add(JOB_NAMES.INDEX_FILE_SOURCE, {
          knowledgeBaseSourceId: source.id,
          workspaceId,
          chunkConfig: normalizedChunkConfig,
        });
        await this.prisma.knowledgeBaseSource.update({
          where: { id: source.id },
          data: { indexingStatus: 'PROCESSING' },
        });

        if (refreshRate !== 'never') {
          await this.scheduleUrlRefresh(source.id, workspaceId, refreshRate, normalizedChunkConfig);
        }
      } catch (queueError) {
        this.logger.error(`Failed to queue URL indexing job: ${queueError.message}`, queueError.stack);
      }

      created.push(source);
    }

    return { knowledgeBaseId, created: created.length, sources: created };
  }

  /** Add (or replace) a repeatable job that re-indexes a URL source. */
  private async scheduleUrlRefresh(
    sourceId: string,
    workspaceId: string,
    rate: Exclude<RefreshRate, 'never'>,
    chunkConfig: unknown,
  ) {
    const cron = REFRESH_CRON[rate];
    try {
      await this.indexingQueue.add(
        JOB_NAMES.INDEX_FILE_SOURCE,
        { knowledgeBaseSourceId: sourceId, workspaceId, chunkConfig },
        { repeat: { cron }, jobId: `refresh:${sourceId}` },
      );
      this.logger.log(`Scheduled ${rate} refresh (${cron}) for source ${sourceId}`);
    } catch (e) {
      this.logger.warn(`Failed to schedule refresh for source ${sourceId}: ${(e as Error).message}`);
    }
  }

  /** Remove a repeatable refresh job for a source (best-effort). */
  private async removeUrlRefresh(sourceId: string, rate?: string | null) {
    if (!rate || rate === 'never' || !REFRESH_CRON[rate as Exclude<RefreshRate, 'never'>]) return;
    try {
      await this.indexingQueue.removeRepeatable(JOB_NAMES.INDEX_FILE_SOURCE, {
        cron: REFRESH_CRON[rate as Exclude<RefreshRate, 'never'>],
        jobId: `refresh:${sourceId}`,
      });
      this.logger.log(`Removed refresh schedule for source ${sourceId}`);
    } catch (e) {
      this.logger.warn(`Failed to remove refresh for source ${sourceId}: ${(e as Error).message}`);
    }
  }

  // ===========================================================================
  // PR-4: KB settings persistence + embedding-model abstraction
  // ===========================================================================

  private defaultSettings() {
    return {
      embeddingProvider: 'gemini',
      embeddingModel: DEFAULT_EMBEDDING_MODEL,
      retrievalConfig: {
        topK: 5,
        systemPrompt: 'You are a helpful assistant. Answer using only the provided context.',
        temperature: 0.7,
        maxTokens: 1024,
      },
      defaultChunkConfig: { strategies: [], chunkSize: DEFAULT_CHUNK_SIZE, chunkOverlap: DEFAULT_CHUNK_OVERLAP },
    };
  }

  async getKnowledgeBaseSettings(knowledgeBaseId: string, workspaceId: string) {
    const kb = await this.findKnowledgeBaseById(knowledgeBaseId, workspaceId);
    const defaults = this.defaultSettings();
    const model = (kb as any).embeddingModel || defaults.embeddingModel;
    const spec = EMBEDDING_MODEL_REGISTRY[model];
    return {
      embeddingProvider: (kb as any).embeddingProvider || defaults.embeddingProvider,
      embeddingModel: model,
      embeddingDimension: spec ? spec.dimension : undefined,
      maxChunkChars: spec ? spec.maxChunkChars : undefined,
      retrievalConfig: { ...defaults.retrievalConfig, ...((kb as any).retrievalConfig || {}) },
      defaultChunkConfig: { ...defaults.defaultChunkConfig, ...((kb as any).defaultChunkConfig || {}) },
      // expose registry so the UI can build model-aware chunk-size sliders
      availableModels: Object.entries(EMBEDDING_MODEL_REGISTRY).map(([name, s]) => ({
        model: name,
        provider: s.provider,
        dimension: s.dimension,
        maxChunkChars: s.maxChunkChars,
      })),
    };
  }

  async updateKnowledgeBaseSettings(
    knowledgeBaseId: string,
    dto: KnowledgeBaseSettingsDto,
    workspaceId: string,
  ) {
    const kb = await this.findKnowledgeBaseById(knowledgeBaseId, workspaceId);
    const prevModel = (kb as any).embeddingModel || DEFAULT_EMBEDDING_MODEL;

    const data: Record<string, unknown> = {};

    if (dto.embeddingModel) {
      const spec = EMBEDDING_MODEL_REGISTRY[dto.embeddingModel];
      if (!spec) throw new BadRequestException(`Unknown embedding model "${dto.embeddingModel}"`);
      data.embeddingModel = dto.embeddingModel;
      data.embeddingProvider = spec.provider;
    } else if (dto.embeddingProvider) {
      data.embeddingProvider = dto.embeddingProvider;
    }

    if (dto.retrievalConfig) {
      data.retrievalConfig = { ...((kb as any).retrievalConfig || {}), ...dto.retrievalConfig };
    }
    if (dto.defaultChunkConfig) {
      data.defaultChunkConfig = normalizeChunkConfig({
        strategies: dto.defaultChunkConfig.strategies,
        chunkSize: dto.defaultChunkConfig.chunkSize,
        chunkOverlap: dto.defaultChunkConfig.chunkOverlap,
      });
    }

    await this.prisma.knowledgeBase.update({ where: { id: knowledgeBaseId }, data });

    // If the embedding model changed to a different vector space, the existing
    // collection is now incompatible: drop it and re-index every source so the
    // new model's dimension is used ("model hopping").
    let reindexed = 0;
    const newModel = (data.embeddingModel as string) || prevModel;
    const prevDim = EMBEDDING_MODEL_REGISTRY[prevModel]?.dimension;
    const newDim = EMBEDDING_MODEL_REGISTRY[newModel]?.dimension;
    if (data.embeddingModel && newModel !== prevModel) {
      this.logger.log(`Embedding model changed ${prevModel} -> ${newModel} (dim ${prevDim}->${newDim}); re-indexing KB ${knowledgeBaseId}`);
      try {
        await this.vectorDb.deleteCollection(`kb_${knowledgeBaseId}`);
      } catch (e) {
        this.logger.warn(`Failed to drop collection during model change: ${(e as Error).message}`);
      }
      const sources = await this.prisma.knowledgeBaseSource.findMany({
        where: { knowledgeBaseId },
      });
      for (const s of sources) {
        await (this.prisma as any).chunkMetadata.deleteMany({ where: { sourceId: s.id } });
        await this.prisma.knowledgeBaseSource.update({
          where: { id: s.id },
          data: { indexingStatus: 'PENDING', hasIndexedContent: false },
        });
        await this.indexingQueue.add(JOB_NAMES.INDEX_FILE_SOURCE, {
          knowledgeBaseSourceId: s.id,
          workspaceId,
          chunkConfig: (s as any).chunkConfig || undefined,
        });
        reindexed++;
      }
    }

    return { ...(await this.getKnowledgeBaseSettings(knowledgeBaseId, workspaceId)), reindexedSources: reindexed };
  }

  // ===========================================================================
  // PR-5: Chunk management + real retrieval test
  // ===========================================================================

  async listChunks(
    knowledgeBaseId: string,
    workspaceId: string,
    opts: { page?: number; pageSize?: number; sourceId?: string } = {},
  ) {
    await this.findKnowledgeBaseById(knowledgeBaseId, workspaceId);
    const page = Math.max(1, opts.page || 1);
    const pageSize = Math.min(Math.max(1, opts.pageSize || 20), 100);
    const where: Record<string, unknown> = { knowledgeBaseId };
    if (opts.sourceId) where.sourceId = opts.sourceId;

    const [total, items] = await Promise.all([
      (this.prisma as any).chunkMetadata.count({ where }),
      (this.prisma as any).chunkMetadata.findMany({
        where,
        orderBy: [{ sourceId: 'asc' }, { chunkIndex: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { source: { select: { id: true, title: true, sourceType: true, sourceUrl: true } } },
      }),
    ]);

    return { total, page, pageSize, items };
  }

  async getChunk(knowledgeBaseId: string, chunkId: string, workspaceId: string) {
    await this.findKnowledgeBaseById(knowledgeBaseId, workspaceId);
    const meta = await (this.prisma as any).chunkMetadata.findFirst({
      where: { id: chunkId, knowledgeBaseId },
    });
    if (!meta) throw new NotFoundException(`Chunk ${chunkId} not found`);

    let text = meta.textPreview;
    try {
      const [point] = await this.vectorDb.retrieve(`kb_${knowledgeBaseId}`, [meta.vectorId]);
      if (point?.payload?.text) text = point.payload.text;
    } catch (e) {
      this.logger.warn(`Failed to fetch full chunk text: ${(e as Error).message}`);
    }
    return { ...meta, text };
  }

  async updateChunk(knowledgeBaseId: string, chunkId: string, text: string, workspaceId: string) {
    await this.findKnowledgeBaseById(knowledgeBaseId, workspaceId);
    const meta = await (this.prisma as any).chunkMetadata.findFirst({
      where: { id: chunkId, knowledgeBaseId },
    });
    if (!meta) throw new NotFoundException(`Chunk ${chunkId} not found`);

    await this.indexingQueue.add(JOB_NAMES.REEMBED_CHUNK, {
      knowledgeBaseId,
      sourceId: meta.sourceId,
      chunkMetadataId: meta.id,
      vectorId: meta.vectorId,
      text,
    });
    return { success: true, chunkId, status: 'reembedding' };
  }

  async deleteChunk(knowledgeBaseId: string, chunkId: string, workspaceId: string) {
    await this.findKnowledgeBaseById(knowledgeBaseId, workspaceId);
    const meta = await (this.prisma as any).chunkMetadata.findFirst({
      where: { id: chunkId, knowledgeBaseId },
    });
    if (!meta) throw new NotFoundException(`Chunk ${chunkId} not found`);

    try {
      await this.vectorDb.deleteByIds(`kb_${knowledgeBaseId}`, [meta.vectorId]);
    } catch (e) {
      this.logger.warn(`Failed to delete vector ${meta.vectorId}: ${(e as Error).message}`);
    }
    await (this.prisma as any).chunkMetadata.delete({ where: { id: meta.id } });
    return { success: true, chunkId };
  }

  /**
   * Real retrieval test: embed the question with the KB's model, search Qdrant,
   * and generate a grounded answer using the KB's retrieval config.
   */
  async retrieveTest(knowledgeBaseId: string, question: string, workspaceId: string) {
    const kb = await this.findKnowledgeBaseById(knowledgeBaseId, workspaceId);
    const embeddingModel = (kb as any).embeddingModel || DEFAULT_EMBEDDING_MODEL;
    const retrievalConfig = { ...this.defaultSettings().retrievalConfig, ...((kb as any).retrievalConfig || {}) };

    const processed = this.ragService.preprocessQuery(question);
    const results = await this.ragService.searchKnowledgeBase(
      knowledgeBaseId,
      processed,
      retrievalConfig.topK,
      embeddingModel,
    );

    const chunks = results.map((r: any) => ({
      vectorId: r.id,
      score: r.score,
      text: r.payload?.text || '',
      chunkType: r.payload?.chunkType || 'content',
      sourceId: r.payload?.sourceId,
      sourceUrl: r.payload?.sourceUrl || null,
      fileName: r.payload?.fileName || null,
    }));

    const answer = await this.generateGroundedAnswer(question, chunks, retrievalConfig);
    return { question, embeddingModel, topK: retrievalConfig.topK, chunks, answer };
  }

  private async generateGroundedAnswer(
    question: string,
    chunks: { text: string }[],
    retrievalConfig: { systemPrompt?: string; temperature?: number; maxTokens?: number },
  ): Promise<string> {
    if (!chunks.length) {
      return "I couldn't find anything relevant in this knowledge base to answer that.";
    }
    if (!this.genAI) {
      return 'Retrieved context is shown below, but no answer model (GEMINI_API_KEY) is configured.';
    }
    try {
      const context = chunks
        .map((c, i) => `[Document ${i + 1}]\n${c.text}`)
        .join('\n\n');
      const systemPrompt =
        retrievalConfig.systemPrompt ||
        'You are a helpful assistant. Answer using only the provided context.';
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        systemInstruction: `${systemPrompt}\n\nContext information:\n${context}`,
        generationConfig: {
          temperature: retrievalConfig.temperature ?? 0.7,
          maxOutputTokens: retrievalConfig.maxTokens ?? 1024,
        },
      });
      const result = await model.generateContent(question);
      return result.response.text() || 'No answer generated.';
    } catch (e) {
      this.logger.error(`Error generating grounded answer: ${(e as Error).message}`);
      return `Error generating answer: ${(e as Error).message}`;
    }
  }
}