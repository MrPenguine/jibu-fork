import { Process, Processor } from '@nestjs/bull';
import { Logger, Injectable, Inject } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../../../backend/src/core/database/prisma.service';
import { FileService } from '../../../backend/src/modules/v1/file/file.service';
import { ChunkingService } from '../chunking/chunking.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { VectorDbService } from '../vector-db/vector-db.service';
import axios from 'axios';
import { 
  QUEUE_NAMES, 
  JOB_NAMES, 
  IndexFileSourceJobData, 
  DeindexSourceJobData 
} from '@jibu/queue-definitions';

@Injectable()
@Processor(QUEUE_NAMES.INDEXING)
export class IndexingProcessor {
  private readonly logger = new Logger(IndexingProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileService,
    private readonly chunkingService: ChunkingService,
    private readonly embeddingService: EmbeddingService,
    private readonly vectorDbService: VectorDbService
  ) {}

  @Process(JOB_NAMES.INDEX_FILE_SOURCE)
  async processIndexFileSource(job: Job<IndexFileSourceJobData>) {
    this.logger.debug(
      `Processing index job ${job.id} for source: ${job.data.knowledgeBaseSourceId} in org: ${job.data.organizationId}`
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
      
      this.logger.debug(`Found source with file: ${source.file.name}`);
      
      // 2. Get a signed download URL for the file using FileService
      const downloadUrl = await this.fileService.getDownloadUrl(
        source.file.id, 
        source.organizationId
      );
      
      this.logger.debug(`Got signed download URL for file: ${source.file.name}`);
      
      // 3. Download the file content using axios
      const response = await axios.get(downloadUrl, {
        responseType: 'arraybuffer'
      });
      
      const fileContent = response.data;
      this.logger.debug(`Downloaded file content, size: ${fileContent.length} bytes`);
      
      // Check file type to determine how to handle it
      const mimeType = source.file.mimeType;
      let textContent = '';
      
      if (mimeType.startsWith('text/')) {
        // For text files, use the content directly
        textContent = Buffer.from(fileContent).toString('utf-8');
      } else if (mimeType.includes('pdf')) {
        // For PDF files, you would extract text
        textContent = Buffer.from(fileContent).toString('utf-8'); // Simplified for now - would use PDF parser
      } else {
        // Handle other file types or throw error if unsupported
        textContent = Buffer.from(fileContent).toString('utf-8'); // Simplified for now
      }
      
      // 4. Split text into chunks
      const chunks = await this.chunkingService.splitTextIntoChunks(textContent);
      this.logger.debug(`Split text into ${chunks.length} chunks`);
      
      // Log sample chunk data
      if (chunks.length > 0) {
        this.logger.debug(`Sample chunk (1/${chunks.length}): "${chunks[0].substring(0, 200)}${chunks[0].length > 200 ? '...' : ''}"`);
        if (chunks.length > 1) {
          this.logger.debug(`Sample chunk (2/${chunks.length}): "${chunks[1].substring(0, 200)}${chunks[1].length > 200 ? '...' : ''}"`);
        }
      }
      
      // 5. Create vector collection if it doesn't exist
      const collectionName = `kb_${source.knowledgeBaseId}`;
      await this.vectorDbService.ensureCollection(collectionName);
      
      // 6. Generate embeddings for each chunk
      const embeddings = await this.embeddingService.embedTexts(chunks);
      this.logger.debug(`Generated ${embeddings.length} embeddings`);
      
      // Log sample embedding data
      if (embeddings.length > 0) {
        this.logger.debug(`Sample embedding (1/${embeddings.length}): [${embeddings[0].slice(0, 5).join(', ')}${embeddings[0].length > 5 ? '...' : ''}], dimension: ${embeddings[0].length}`);
      }
      
      // 7. Store embeddings in vector database
      const points = chunks.map((chunk, index) => ({
        id: `${source.id}_chunk_${index}`,
        vector: embeddings[index],
        payload: {
          text: chunk,
          sourceId: source.id,
          fileId: source.sourcePointer,
          fileName: source.file.name,
          knowledgeBaseId: source.knowledgeBaseId,
          organizationId: source.organizationId,
          chunkIndex: index
        }
      }));
      
      await this.vectorDbService.upsert(collectionName, { points });
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
      
      // 8. Store chunk metadata in the database
      const chunkMetadataPromises = points.map((point, index) => {
        // Sanitize text to avoid UTF-8 encoding issues - remove null bytes and non-printable characters
        const sanitizedText = chunks[index].replace(/[\x00-\x09\x0B-\x1F\x7F-\x9F]/g, '');
        const textPreview = sanitizedText.substring(0, 100); // First 100 chars as preview
        
        return (this.prisma as any).chunkMetadata.create({
          data: {
            knowledgeBaseId: source.knowledgeBaseId,
            sourceId: source.id,
            chunkIndex: index,
            vectorId: point.id,
            textPreview: textPreview,
            textLength: sanitizedText.length,
          }
        });
      });
      
      await Promise.all(chunkMetadataPromises);
      this.logger.debug(`Stored ${chunkMetadataPromises.length} chunk metadata records`);
      
      // 9. Update the source status to COMPLETED and set hasIndexedContent to true
      // @ts-ignore - PrismaClient models are not properly typed
      await this.prisma.knowledgeBaseSource.update({
        where: { id: source.id },
        data: { 
          indexingStatus: 'INDEXED',
          // @ts-ignore - New field not yet in TypeScript definitions
          hasIndexedContent: true
        }
      });
      
      this.logger.debug(`Indexing job ${job.id} completed successfully`);
      return { 
        success: true, 
        jobId: job.id, 
        knowledgeBaseId: source.knowledgeBaseId,
        sourceId: source.id,
        chunks: chunks.length,
        vectors: embeddings.length
      };
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
      
      try {
        // Try to get KB ID from database if the source still exists
        // @ts-ignore - PrismaClient models are not properly typed
        const source = await this.prisma.knowledgeBaseSource.findUnique({
          where: { id: job.data.knowledgeBaseSourceId }
        });
        
        if (source) {
          knowledgeBaseId = source.knowledgeBaseId;
        }
      } catch (error) {
        // If source doesn't exist, might be because it was already deleted
        this.logger.warn(`Source ${job.data.knowledgeBaseSourceId} not found, proceeding with deindexing anyway`);
      }
      
      // We don't have knowledgeBaseId in DeindexSourceJobData, but we can extract it from the source info we just got
      // If we couldn't get the knowledgeBaseId, we'll have to error out
      
      if (!knowledgeBaseId) {
        throw new Error('Knowledge base ID not found for source');
      }
      
      // 3. Delete vectors for this source from the vector database
      const collectionName = `kb_${knowledgeBaseId}`;
      
      // Check if collection exists
      const collections = await this.vectorDbService.getCollections();
      const collectionExists = collections.collections.some(c => c.name === collectionName);
      
      if (collectionExists) {
        await this.vectorDbService.delete(collectionName, {
          filter: {
            must: [
              {
                key: 'sourceId',
                match: { value: job.data.knowledgeBaseSourceId }
              }
            ]
          }
        });
        
        this.logger.debug(`Deleted vectors for source ${job.data.knowledgeBaseSourceId} from collection ${collectionName}`);
      } else {
        this.logger.warn(`Collection ${collectionName} not found, skipping vector deletion`);
      }
      
      // Delete chunk metadata for this source
      try {
        await (this.prisma as any).chunkMetadata.deleteMany({
          where: { sourceId: job.data.knowledgeBaseSourceId }
        });
        this.logger.debug(`Deleted chunk metadata for source ${job.data.knowledgeBaseSourceId}`);
        
        // Update hasIndexedContent flag if source still exists
        if (knowledgeBaseId) {
          await this.prisma.knowledgeBaseSource.update({
            where: { id: job.data.knowledgeBaseSourceId },
            data: { 
              // @ts-ignore - New field not yet in TypeScript definitions
              hasIndexedContent: false 
            }
          });
        }
      } catch (error) {
        this.logger.error(`Error deleting chunk metadata: ${error.message}`, error.stack);
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
} 