import { Process, Processor } from '@nestjs/bull';
import { Logger, Injectable, Inject } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../../../backend/src/core/database/prisma.service';
import { FileService } from '../../../backend/src/modules/v1/file/file.service';
import { ChunkingService } from '../chunking/chunking.service';
import { StrategyChunkingService } from '../chunking/strategy-chunking.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { VectorDbService } from '../vector-db/vector-db.service';
import axios from 'axios';
import { 
  QUEUE_NAMES, 
  JOB_NAMES, 
  IndexFileSourceJobData, 
  DeindexSourceJobData,
  ReembedChunkJobData 
} from '@jibu/queue-definitions';
import { randomUUID } from 'crypto';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
// Don't directly import pdf-parse to allow for dynamic loading
// We'll check if it's available and install it if needed

@Injectable()
@Processor(QUEUE_NAMES.INDEXING)
export class IndexingProcessor {
  private readonly logger = new Logger(IndexingProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileService,
    private readonly chunkingService: ChunkingService,
    private readonly strategyChunkingService: StrategyChunkingService,
    private readonly embeddingService: EmbeddingService,
    private readonly vectorDbService: VectorDbService,
    @InjectQueue(QUEUE_NAMES.INDEXING) private readonly indexingQueue: Queue
  ) {
    // Store queue in global for access from other methods
    global['BULL_INDEXING_QUEUE'] = this.indexingQueue;
    
    // Log the worker concurrency setting
    const concurrency = parseInt(process.env.INDEXING_CONCURRENCY || '2', 10);
    this.logger.log(`Indexing processor initialized with target concurrency: ${concurrency}`);
  }

  @Process(JOB_NAMES.INDEX_FILE_SOURCE)
  async processIndexFileSource(job: Job<IndexFileSourceJobData>) {
    this.logger.debug(
      `Processing index job ${job.id} for source: ${job.data.knowledgeBaseSourceId} in workspace: ${job.data.workspaceId}`
    );
    
    try {
      // 1. Get the source from the database
      // @ts-ignore - PrismaClient models are not properly typed
      const source = await this.prisma.knowledgeBaseSource.findUnique({
        where: { id: job.data.knowledgeBaseSourceId },
        include: {
          file: true,
          knowledgeBase: true
        }
      });
      
      if (!source) {
        throw new Error(`Source with ID ${job.data.knowledgeBaseSourceId} not found`);
      }

      const sourceType = (source as any).sourceType || 'file';
      const isUrlSource = sourceType === 'url' || sourceType === 'sitemap';

      // Update status to PROCESSING
      await this.prisma.knowledgeBaseSource.update({
        where: { id: source.id },
        data: { indexingStatus: 'PROCESSING' }
      });

      // Text extraction differs by source type: files are downloaded from
      // storage, while url/sitemap sources are fetched over HTTP and stripped
      // to plain text. Both converge on the same chunk -> embed -> upsert path.
      let mimeType: string;
      let sourceName: string;
      let filePointer: string | null;
      let textContent = '';

      if (isUrlSource) {
        const url = (source as any).sourceUrl;
        if (!url) {
          throw new Error(`URL source ${source.id} has no sourceUrl`);
        }
        sourceName = (source as any).title || url;
        filePointer = null;
        mimeType = 'text/html';
        this.logger.debug(`Fetching URL source: ${url}`);
        try {
          textContent = await this.fetchAndExtractUrl(url);
        } catch (error) {
          this.logger.error(`URL fetch/extract failed for "${url}": ${error.message}`);
          await this.prisma.knowledgeBaseSource.update({
            where: { id: source.id },
            data: { indexingStatus: 'FAILED' },
          });
          throw error;
        }
      } else {
        if (!source.file) {
          throw new Error(`File source ${source.id} has no linked file`);
        }
        this.logger.debug(`Found source with file: ${source.file.name}`);
        mimeType = source.file.mimeType;
        sourceName = source.file.name || '';
        filePointer = source.sourcePointer;

        // Get a signed download URL for the file using FileService
        const downloadUrl = await this.fileService.getDownloadUrl(
          source.file.id,
          source.file.workspaceId
        );
        this.logger.debug(`Got signed download URL for file: ${source.file.name}`);

        // Download the file content using axios
        const response = await axios.get(downloadUrl, {
          responseType: 'arraybuffer'
        });
        const fileContent = response.data;
        this.logger.debug(`Downloaded file content, size: ${fileContent.length} bytes`);

        try {
          textContent = await this.extractTextFromFile(
            Buffer.from(fileContent),
            mimeType,
            sourceName,
            source.id,
          );
        } catch (error) {
          this.logger.error(`Text extraction failed for "${sourceName}" (${mimeType}): ${error.message}`);
          await this.prisma.knowledgeBaseSource.update({
            where: { id: source.id },
            data: { indexingStatus: 'FAILED' },
          });
          throw error;
        }
      }
      const fileName = sourceName;
      
      // Sanitize text to ensure it's valid UTF-8
      textContent = this.sanitizeText(textContent);
      
      // 4. Split text into chunks using the configured strategy pipeline
      const chunkConfig = job.data.chunkConfig || (source as any).chunkConfig || {};
      this.logger.debug(`Chunking with config: ${JSON.stringify(chunkConfig)}`);
      const chunkResults = await this.strategyChunkingService.chunk(textContent, mimeType, chunkConfig);
      const chunks = chunkResults.map((c) => c.text);
      this.logger.debug(`Split text into ${chunks.length} chunks`);
      
      // Log sample chunk data
      if (chunks.length > 0) {
        this.logger.debug(`Sample chunk (1/${chunks.length}): "${chunks[0].substring(0, 200)}${chunks[0].length > 200 ? '...' : ''}"`);
        if (chunks.length > 1) {
          this.logger.debug(`Sample chunk (2/${chunks.length}): "${chunks[1].substring(0, 200)}${chunks[1].length > 200 ? '...' : ''}"`);
        }
      }
      
      // Resolve the per-KB embedding model so documents and queries embed with
      // the SAME model. Falls back to the env/Gemini default for legacy KBs.
      const embeddingModel = (source as any).knowledgeBase?.embeddingModel || null;
      const embeddingDimension = this.embeddingService.getDimension(embeddingModel);

      // 5. Create vector collection sized for this KB's embedding dimension
      const collectionName = `kb_${source.knowledgeBaseId}`;
      await this.vectorDbService.ensureCollection(collectionName, embeddingDimension);

      // Idempotency: on a re-index/refresh, purge this source's existing vectors
      // and chunk metadata first so we don't accumulate duplicates.
      try {
        await this.vectorDbService.delete(collectionName, {
          filter: { must: [{ key: 'sourceId', match: { value: source.id } }] },
          wait: true,
        });
        await (this.prisma as any).chunkMetadata.deleteMany({ where: { sourceId: source.id } });
        this.logger.debug(`Cleared existing vectors/metadata for source ${source.id} before re-index`);
      } catch (cleanupError) {
        this.logger.warn(`Pre-index cleanup failed for source ${source.id}: ${cleanupError.message}`);
      }
      
      // 6. Generate embeddings for each chunk using the KB's model
      const embeddings = await this.embeddingService.embedDocuments(
        chunks.map(chunk => ({ text: chunk })),
        { model: embeddingModel },
      );
      this.logger.debug(`Generated ${embeddings.length} embeddings (model: ${embeddingModel || 'default'}, dim: ${embeddingDimension})`);
      
      // Log sample embedding data
      if (embeddings.length > 0) {
        this.logger.debug(`Sample embedding (1/${embeddings.length}): [${embeddings[0].slice(0, 5).join(', ')}${embeddings[0].length > 5 ? '...' : ''}], dimension: ${embeddings[0].length}`);
      }
      
      // 7. Store embeddings in vector database
      const points = chunks.map((chunk, index) => {
        // Generate a proper UUID for each vector point
        const pointId = randomUUID();
        
        return {
          id: pointId,
          vector: embeddings[index],
          payload: {
            text: chunk,
            sourceId: source.id,
            fileId: filePointer,
            fileName: sourceName,
            sourceType,
            sourceUrl: (source as any).sourceUrl || null,
            knowledgeBaseId: source.knowledgeBaseId,
            workspaceId: source.workspaceId,
            chunkIndex: index,
            chunkType: chunkResults[index]?.chunkType || 'content',
            strategies: chunkResults[index]?.strategies || []
          }
        };
      });
      
      await this.vectorDbService.upsert(collectionName, { points, dimension: embeddingDimension } as any);
      this.logger.debug(`Stored ${points.length} vector points in collection ${collectionName}`);
      
      // Log sample vector point
      if (points.length > 0) {
        this.logger.debug(`Sample vector point ID: ${points[0].id}`);
        this.logger.debug(`Sample vector point payload: ${JSON.stringify({
          sourceId: points[0].payload.sourceId,
          fileName: points[0].payload.fileName,
          knowledgeBaseId: points[0].payload.knowledgeBaseId,
          chunkIndex: points[0].payload.chunkIndex,
          textPreview: points[0].payload.text.substring(0, 100) + '...'
        })}`);
      }
      
      // 8. Store chunk metadata in the database - Use a batch approach instead of parallel promises
      this.logger.debug(`Storing ${points.length} chunk metadata records in batches`);
      
      // Verify source exists in database before continuing
      try {
        // Double-check that the source still exists before creating metadata
        const sourceExists = await this.prisma.knowledgeBaseSource.findUnique({
          where: { id: source.id }
        });
        
        if (!sourceExists) {
          this.logger.error(`Source ${source.id} not found in database before creating chunk metadata. Aborting.`);
          throw new Error(`Source ${source.id} was deleted during processing`);
        }
      } catch (error) {
        this.logger.error(`Error verifying source: ${error.message}`);
        throw error;
      }
      
      // Prepare the data for batch creation
      const chunkMetadataData = points.map((point, index) => {
        // Enhanced sanitization to handle PDF binary content and other problematic characters
        const sanitizedText = chunks[index]
          // Remove null bytes, control characters, and non-printable characters
          .replace(/[\x00-\x09\x0B-\x1F\x7F-\x9F]/g, '')
          // Replace invalid hex escapes that could cause JSON parsing issues
          .replace(/\\x[0-9a-fA-F]?(?![0-9a-fA-F])/g, '')
          // Handle any other problematic unicode or encoding issues
          .replace(/\\u[0-9a-fA-F]{0,3}(?![0-9a-fA-F])/g, '')
          // Ensure the string is valid UTF-8
          .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
          
        // Limit preview to safe characters only
        const textPreview = sanitizedText.substring(0, 100); // First 100 chars as preview
        
        return {
          knowledgeBaseId: source.knowledgeBaseId,
          sourceId: source.id,
          chunkIndex: index,
          vectorId: point.id,
          textPreview: textPreview,
          textLength: sanitizedText.length,
          chunkType: chunkResults[index]?.chunkType || 'content',
          strategies: chunkResults[index]?.strategies || [],
        };
      });
      
      // Create chunks in smaller batches with delay between batches to prevent connection pool exhaustion
      const BATCH_SIZE = 25; // Smaller batch size to reduce connection pressure
      let successfulBatches = 0;
      let failedBatches = 0;
      let totalSuccessfulItems = 0;
      let consecutiveFailedBatches = 0;
      const MAX_CONSECUTIVE_FAILED_BATCHES = 5;
      
      for (let i = 0; i < chunkMetadataData.length; i += BATCH_SIZE) {
        const batch = chunkMetadataData.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i/BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(chunkMetadataData.length/BATCH_SIZE);
        
        this.logger.debug(`Processing chunk metadata batch ${batchNumber} of ${totalBatches}`);
        
        try {
          // Before processing each batch, verify the source still exists
          const sourceStillExists = await this.prisma.knowledgeBaseSource.findUnique({
            where: { id: source.id }
          });
          
          if (!sourceStillExists) {
            this.logger.error(`Source ${source.id} no longer exists. Aborting metadata creation.`);
            throw new Error('Source was deleted during processing');
          }
          
          // Process each item individually
          let batchSuccessCount = 0;
          for (let j = 0; j < batch.length; j++) {
            try {
              // Process each item individually to prevent one bad item from failing the batch
              await (this.prisma as any).chunkMetadata.create({ 
                data: batch[j] 
              });
              batchSuccessCount++;
              totalSuccessfulItems++;
            } catch (itemError) {
              if (itemError.message.includes('Foreign key constraint')) {
                this.logger.warn(`Foreign key constraint error for item ${j} in batch ${batchNumber}: Source may have been deleted`);
                // Critical error - source is gone, no point continuing
                throw new Error('Source reference lost during processing');
              } else {
                this.logger.warn(`Failed to create chunk metadata for item ${j} in batch ${batchNumber}: ${itemError.message}`);
                // Continue with other items in the batch
              }
            }
          }
          
          if (batchSuccessCount > 0) {
            successfulBatches++;
            consecutiveFailedBatches = 0; // Reset the counter when a batch succeeds
          } else {
            failedBatches++;
            consecutiveFailedBatches++;
            
            if (consecutiveFailedBatches >= MAX_CONSECUTIVE_FAILED_BATCHES) {
              this.logger.error(`${MAX_CONSECUTIVE_FAILED_BATCHES} consecutive batches failed. Aborting.`);
              throw new Error(`Excessive consecutive batch failures: ${consecutiveFailedBatches}`);
            }
          }
          
          // Add a small delay between batches to allow connections to be released
          if (i + BATCH_SIZE < chunkMetadataData.length) {
            this.logger.debug('Pausing briefly between batches to manage connection pool');
            await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay between batches
          }
        } catch (error) {
          this.logger.error(`Error processing batch ${batchNumber}: ${error.message}`);
          failedBatches++;
          consecutiveFailedBatches++;
          
          if (error.message.includes('Source') || 
              error.message.includes('Foreign key constraint') || 
              consecutiveFailedBatches >= MAX_CONSECUTIVE_FAILED_BATCHES) {
            this.logger.error('Critical error detected, aborting further processing');
            break; // Stop processing remaining batches
          }
          
          // Continue with next batch instead of failing the entire process
          if (i + BATCH_SIZE < chunkMetadataData.length) {
            this.logger.debug('Continuing with next batch after error');
            await new Promise(resolve => setTimeout(resolve, 1000)); // Longer delay after error
          }
        }
      }
      
      // Log summary of batch processing
      this.logger.log(`Chunk metadata processing completed. Success: ${successfulBatches}/${Math.ceil(chunkMetadataData.length/BATCH_SIZE)} batches, ${totalSuccessfulItems}/${chunkMetadataData.length} items`);
      
      // If we succeeded with some metadata but not all, still continue
      if (totalSuccessfulItems > 0) {
        this.logger.debug(`Stored ${totalSuccessfulItems} chunk metadata records successfully`);
      } else {
        throw new Error("Failed to store any chunk metadata records");
      }
      
      // 9. Update the source status to COMPLETED and set hasIndexedContent to true
      try {
        // Verify some vectors were stored in the database
        if (totalSuccessfulItems === 0) {
          throw new Error('No vectors were successfully stored');
        }

        // Verify chunks were created in the metadata table
        const chunkCount = await this.prisma.chunkMetadata.count({
          where: {
            sourceId: source.id
          }
        });

        this.logger.log(`Found ${chunkCount} chunk metadata records for source ${source.id}`);
        
        // Set source as COMPLETED if we have at least some chunk metadata
        await this.prisma.knowledgeBaseSource.update({
          where: { id: source.id },
          data: { 
            indexingStatus: chunkCount > 0 ? 'COMPLETED' : 'FAILED',
            hasIndexedContent: chunkCount > 0
          }
        });

        // Get all sources in this knowledge base to check overall status
        const allSources = await this.prisma.knowledgeBaseSource.findMany({
          where: { knowledgeBaseId: source.knowledgeBaseId },
          select: { 
            id: true,
            indexingStatus: true
          }
        });

        // Log source statuses for debugging
        this.logger.debug(`Source statuses for knowledge base ${source.knowledgeBaseId}: ${JSON.stringify(allSources.map(s => ({id: s.id, status: s.indexingStatus})))}`);

        // Check if there are any sources still processing 
        const stillProcessing = allSources.some(s => 
          s.id !== source.id && 
          (s.indexingStatus === 'PROCESSING' || s.indexingStatus === 'PENDING')
        );

        if (stillProcessing) {
          this.logger.debug(`Other sources still processing in knowledge base ${source.knowledgeBaseId}`);
        } else {
          this.logger.debug(`All sources in knowledge base ${source.knowledgeBaseId} are now processed`);
        }

        this.logger.debug(`Indexing job ${job.id} completed successfully`);
        return { 
          success: true, 
          jobId: job.id, 
          knowledgeBaseId: source.knowledgeBaseId,
          sourceId: source.id,
          chunks: chunks.length,
          vectors: embeddings.length,
          storedMetadata: chunkCount
        };
      } catch (error) {
        this.logger.error(`Error updating source status: ${error.message}`);
        
        // Attempt to mark as failed if the previous update failed
        try {
          await this.prisma.knowledgeBaseSource.update({
            where: { id: source.id },
            data: { 
              indexingStatus: 'FAILED',
              hasIndexedContent: false
            }
          });
        } catch (updateError) {
          this.logger.error(`Failed to mark source as failed: ${updateError.message}`);
        }
        
        throw error;
      }
    } catch (error) {
      this.logger.error(`Error processing indexing job ${job.id}: ${error.message}`, error.stack);
      
      // Update the source status to ERROR
      try {
        // @ts-ignore - PrismaClient models are not properly typed
        await this.prisma.knowledgeBaseSource.update({
          where: { id: job.data.knowledgeBaseSourceId },
          data: { indexingStatus: 'ERROR' }
        });
      } catch (updateError) {
        this.logger.error(`Failed to update source status: ${updateError.message}`);
      }
      
      throw error;
    }
  }

  @Process(JOB_NAMES.DEINDEX_SOURCE)
  async processDeindexSource(job: Job<DeindexSourceJobData>) {
    this.logger.debug(
      `Processing deindex job ${job.id} for source: ${job.data.knowledgeBaseSourceId}, type: ${job.data.sourceType}`
    );
    
    try {
      // 1. Get the knowledge base ID for this source
      let knowledgeBaseId = '';
      
      // First check if knowledgeBaseId is provided in job data (new format)
      if (job.data.knowledgeBaseId) {
        this.logger.debug(`Using knowledgeBaseId from job data: ${job.data.knowledgeBaseId}`);
        knowledgeBaseId = job.data.knowledgeBaseId;
      } else {
        // Fallback to getting it from the database (old format)
        this.logger.debug(`No knowledgeBaseId in job data, trying to get it from database`);
        try {
          // Try to get KB ID from database if the source still exists
          // @ts-ignore - PrismaClient models are not properly typed
          const source = await this.prisma.knowledgeBaseSource.findUnique({
            where: { id: job.data.knowledgeBaseSourceId }
          });
          
          if (source) {
            knowledgeBaseId = source.knowledgeBaseId;
            this.logger.debug(`Found knowledgeBaseId from database: ${knowledgeBaseId}`);
          }
        } catch (error) {
          // If source doesn't exist, might be because it was already deleted
          this.logger.warn(`Source ${job.data.knowledgeBaseSourceId} not found, proceeding with deindexing anyway`);
        }
      }
      
      // If we couldn't get the knowledgeBaseId, we'll have to error out
      if (!knowledgeBaseId) {
        throw new Error('Knowledge base ID not found for source');
      }
      
      // Get all sources in the knowledge base to check their statuses
      const allSources = await this.prisma.knowledgeBaseSource.findMany({
        where: { 
          knowledgeBaseId: knowledgeBaseId 
        },
        select: {
          id: true,
          indexingStatus: true
        }
      });

      this.logger.debug(`Found ${allSources.length} sources in knowledge base, source to deindex: ${job.data.knowledgeBaseSourceId}`);
      this.logger.debug(`Source statuses: ${JSON.stringify(allSources.map(s => ({id: s.id, status: s.indexingStatus})))}`);

      // Count other active sources (excluding the one we're deindexing)
      const otherActiveSourcesCount = allSources.filter(s => 
        s.id !== job.data.knowledgeBaseSourceId && 
        ['COMPLETED', 'PROCESSING', 'PENDING'].includes(s.indexingStatus)
      ).length;

      this.logger.debug(`Other active sources count: ${otherActiveSourcesCount}`);
      
      const collectionName = `kb_${knowledgeBaseId}`;
      
      // Check if collection exists
      const collectionExists = await this.vectorDbService.collectionExists(collectionName);
      
      if (collectionExists) {
        try {
          if (otherActiveSourcesCount === 0) {
            // If this is the last source, delete the entire collection
            this.logger.debug(`No other active sources, deleting collection ${collectionName}`);
            const deleted = await this.vectorDbService.deleteCollection(collectionName);
            if (deleted) {
              this.logger.debug(`Successfully deleted collection ${collectionName}`);
            } else {
              this.logger.warn(`Failed to delete collection ${collectionName}`);
            }
          } else {
            // If there are other sources, just delete vectors for this source
            this.logger.debug(`Found ${otherActiveSourcesCount} other active sources, only deleting vectors for source ${job.data.knowledgeBaseSourceId}`);
            
            try {
              await this.vectorDbService.delete(collectionName, {
                filter: {
                  must: [
                    {
                      key: 'sourceId',
                      match: { value: job.data.knowledgeBaseSourceId }
                    }
                  ]
                },
                wait: true
              });
              this.logger.debug(`Successfully deleted vectors for source ${job.data.knowledgeBaseSourceId}`);
            } catch (deleteError) {
              this.logger.error(`Error deleting vectors: ${deleteError.message}`, deleteError.stack);
            }
          }
          
          // Delete chunk metadata for this source
          await (this.prisma as any).chunkMetadata.deleteMany({
            where: { sourceId: job.data.knowledgeBaseSourceId }
          });
          this.logger.debug(`Deleted chunk metadata for source ${job.data.knowledgeBaseSourceId}`);
          
          // Update the source status
          const sourceExists = await this.prisma.knowledgeBaseSource.findUnique({
            where: { id: job.data.knowledgeBaseSourceId }
          });
          
          if (sourceExists) {
            await this.prisma.knowledgeBaseSource.update({
              where: { id: job.data.knowledgeBaseSourceId },
              data: { 
                // @ts-ignore - New field not yet in TypeScript definitions
                hasIndexedContent: false,
                indexingStatus: 'PENDING'
              }
            });
            this.logger.debug(`Updated hasIndexedContent flag for source ${job.data.knowledgeBaseSourceId}`);
            
            // Queue the reindexing job
            const indexingJobData: IndexFileSourceJobData = {
              knowledgeBaseSourceId: job.data.knowledgeBaseSourceId,
              workspaceId: job.data.workspaceId
            };
            
            // Add job to queue with higher priority
            await this.indexingQueue.add(
              JOB_NAMES.INDEX_FILE_SOURCE,
              indexingJobData,
              { 
                attempts: 3,
                backoff: { type: 'exponential', delay: 2000 },
                priority: 1 // Higher priority (lower number)
              }
            );
            this.logger.debug(`Added reindex job for source ${job.data.knowledgeBaseSourceId} to queue`);
            
          } else {
            this.logger.warn(`Source ${job.data.knowledgeBaseSourceId} no longer exists, skipping update`);
          }
        } catch (error) {
          this.logger.error(`Error handling collection deletion: ${error.message}`, error.stack);
        }
      } else {
        this.logger.warn(`Collection ${collectionName} not found, skipping deletion`);
        
        // Still delete metadata and update source status
        await (this.prisma as any).chunkMetadata.deleteMany({
          where: { sourceId: job.data.knowledgeBaseSourceId }
        });
        this.logger.debug(`Deleted chunk metadata for source ${job.data.knowledgeBaseSourceId}`);
      }
      
      this.logger.debug(`Deindexing job ${job.id} completed successfully`);
      return { 
        success: true, 
        jobId: job.id, 
        knowledgeBaseSourceId: job.data.knowledgeBaseSourceId,
        sourceType: job.data.sourceType
      };
    } catch (error) {
      this.logger.error(`Error processing deindex job ${job.id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Extract plain text from a downloaded file buffer based on its type.
   * Supported: pdf, txt, markdown, csv, docx. Unsupported types throw.
   */
  private async extractTextFromFile(
    buffer: Buffer,
    mimeType: string,
    fileName: string,
    sourceId: string,
  ): Promise<string> {
    const mime = (mimeType || '').toLowerCase();
    const ext = (fileName.split('.').pop() || '').toLowerCase();

    const isPdf = mime.includes('pdf') || ext === 'pdf';
    const isDocx =
      mime.includes('officedocument.wordprocessingml') ||
      mime.includes('msword') ||
      ext === 'docx';
    const isPlainText =
      mime.startsWith('text/') ||
      mime.includes('json') ||
      mime.includes('markdown') ||
      mime.includes('csv') ||
      ['txt', 'md', 'markdown', 'csv', 'tsv', 'text', 'log', 'json'].includes(ext);

    if (isPdf) {
      return this.extractPdf(buffer, sourceId);
    }

    if (isDocx) {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      const text = (result?.value || '').trim();
      if (!text) {
        throw new Error('DOCX contained no extractable text');
      }
      this.logger.debug(`Extracted ${text.length} characters from DOCX "${fileName}"`);
      return text;
    }

    if (isPlainText) {
      const text = buffer.toString('utf-8');
      this.logger.debug(`Extracted ${text.length} characters of plain text from "${fileName}"`);
      return text;
    }

    // Unsupported type — do not silently index binary garbage.
    throw new Error(
      `Unsupported file type "${mimeType || ext || 'unknown'}". Supported types: pdf, txt, md, csv, docx.`,
    );
  }

  /**
   * Extract text from a PDF buffer using pdf-parse, with scanned-document heuristics.
   */
  private async extractPdf(buffer: Buffer, sourceId: string): Promise<string> {
    const pdfParse = require('pdf-parse');
    const header = buffer.slice(0, 5).toString();
    if (!header.startsWith('%PDF-')) {
      throw new Error('Invalid PDF header — file appears corrupted or not a valid PDF');
    }

    const pdfData = await pdfParse(buffer);
    let textContent = pdfData.text || '';

    if (pdfData.info) {
      const producer = (pdfData.info.Producer || '').toLowerCase();
      const creator = (pdfData.info.Creator || '').toLowerCase();
      const isLikelyScanned = ['scan', 'image', 'ocr'].some(
        (k) => producer.includes(k) || creator.includes(k),
      );
      if (isLikelyScanned) {
        this.logger.warn('PDF metadata suggests this may be a scanned document');
      }
    }

    if (!textContent || textContent.trim().length === 0) {
      this.logger.warn('PDF parsing yielded empty text, PDF may require OCR');
      await this.prisma.knowledgeBaseSource.update({
        where: { id: sourceId },
        data: { indexingStatus: 'WARNING' },
      });
      return 'This PDF requires OCR processing. Please convert it to a text-searchable PDF.';
    }

    const pageCount = pdfData.numpages || 1;
    const charsPerPage = textContent.length / pageCount;
    if (charsPerPage < 100) {
      this.logger.warn(
        `Suspiciously low character count per page (${charsPerPage.toFixed(1)}), PDF may be scanned`,
      );
      textContent =
        'Note: This PDF appears to contain very little text and may be a scanned document. OCR processing is recommended.\n\n' +
        textContent;
    } else {
      this.logger.debug(
        `Successfully extracted ${textContent.length} characters from ${pageCount} page PDF`,
      );
    }

    return textContent;
  }

  /**
   * Sanitize text for safe processing and storage
   * This is a gentler sanitization when using proper PDF extraction
   */
  private sanitizeText(text: string): string {
    if (!text) return '';
    
    try {
      // Basic sanitization focused on maintaining text quality while removing problematic characters
      let sanitized = text
        // Remove null bytes and control characters
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        // Replace carriage returns with newlines for consistency
        .replace(/\r\n?/g, '\n')
        // Replace repeated whitespace with a single space (preserve some formatting)
        .replace(/[ \t]+/g, ' ')
        // Remove any remaining replacement characters ()
        .replace(/\uFFFD/g, ' ');
      
      // Limit length to avoid extremely long strings
      if (sanitized.length > 1000000) {
        this.logger.warn(`Text too long (${sanitized.length} chars), truncating to 1M chars`);
        sanitized = sanitized.substring(0, 1000000);
      }
      
      return sanitized;
    } catch (error) {
      this.logger.error(`Error sanitizing text: ${error.message}`);
      return `Unprocessable content (sanitization error: ${error.message})`;
    }
  }

  /**
   * Fetch a web page over HTTP and strip it to readable plain text.
   * Uses cheerio to remove script/style/nav/boilerplate then collapses whitespace.
   */
  private async fetchAndExtractUrl(url: string): Promise<string> {
    const cheerio = require('cheerio');
    const response = await axios.get(url, {
      responseType: 'text',
      timeout: 30000,
      maxContentLength: 20 * 1024 * 1024,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; JibuBot/1.0; +https://jibu.ai/bot)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    const html = response.data as string;
    const $ = cheerio.load(html);

    // Drop non-content nodes
    $('script, style, noscript, iframe, svg, nav, header, footer, form, aside').remove();

    // Prefer main/article content when present, else fall back to body
    const main = $('main').text() || $('article').text() || $('body').text();
    const text = (main || '')
      .replace(/\s+\n/g, '\n')
      .replace(/\n\s+/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!text || text.length < 20) {
      throw new Error(`URL "${url}" yielded no extractable text content`);
    }
    this.logger.debug(`Extracted ${text.length} characters from URL "${url}"`);
    return text;
  }

  /**
   * Re-embed a single chunk after its text was edited: regenerate the vector
   * with the KB's embedding model and upsert the same Qdrant point id in place.
   */
  @Process(JOB_NAMES.REEMBED_CHUNK)
  async processReembedChunk(job: Job<ReembedChunkJobData>) {
    const { knowledgeBaseId, vectorId, text, chunkMetadataId } = job.data;
    this.logger.debug(`Re-embedding chunk ${chunkMetadataId} (vector ${vectorId}) in KB ${knowledgeBaseId}`);

    try {
      const kb = await this.prisma.knowledgeBase.findUnique({
        where: { id: knowledgeBaseId },
      });
      const embeddingModel = (kb as any)?.embeddingModel || null;
      const dimension = this.embeddingService.getDimension(embeddingModel);

      const [vector] = await this.embeddingService.embedDocuments(
        [{ text }],
        { model: embeddingModel },
      );

      const collectionName = `kb_${knowledgeBaseId}`;

      // Read the existing point to preserve its payload, then overwrite vector + text
      const existing = await this.vectorDbService.retrieve(collectionName, [vectorId]);
      const prevPayload = (existing && existing[0] && existing[0].payload) || {};

      await this.vectorDbService.upsert(collectionName, {
        points: [
          {
            id: vectorId,
            vector,
            payload: { ...prevPayload, text },
          },
        ],
        dimension,
      } as any);

      // Keep the Postgres preview in sync
      await (this.prisma as any).chunkMetadata.update({
        where: { id: chunkMetadataId },
        data: {
          textPreview: text.substring(0, 100),
          textLength: text.length,
        },
      });

      this.logger.debug(`Re-embedded chunk ${chunkMetadataId} successfully`);
      return { success: true, vectorId, chunkMetadataId };
    } catch (error) {
      this.logger.error(`Error re-embedding chunk ${chunkMetadataId}: ${error.message}`, error.stack);
      throw error;
    }
  }
} 