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
      
      // Update status to PROCESSING
      await this.prisma.knowledgeBaseSource.update({
        where: { id: source.id },
        data: { indexingStatus: 'PROCESSING' }
      });
      
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
      
      try {
        if (mimeType.startsWith('text/')) {
          // For text files, use the content directly
          textContent = Buffer.from(fileContent).toString('utf-8');
          this.logger.debug(`Extracted ${textContent.length} characters of text content from file`);
        } else if (mimeType.includes('pdf')) {
          // For PDF files, use the pdf-parse library for proper extraction
          try {
            const pdfParse = require('pdf-parse');
            this.logger.debug('Using pdf-parse library for PDF extraction');
            
            // Check for PDF header to confirm it's a valid PDF
            const fileContentBuffer = Buffer.from(fileContent);
            const header = fileContentBuffer.slice(0, 5).toString();
            
            if (header.startsWith('%PDF-')) {
              this.logger.debug('Valid PDF header detected');
              
              // Use pdf-parse for proper PDF extraction
              const pdfData = await pdfParse(fileContentBuffer);
              textContent = pdfData.text || '';
              
              // Log PDF information for debugging
              if (pdfData.info) {
                this.logger.debug(`PDF Info: Pages=${pdfData.numpages}, Version=${pdfData.info.PDFFormatVersion || 'unknown'}`);
                
                // Check if the PDF is possibly a scanned document
                const producer = (pdfData.info.Producer || '').toLowerCase();
                const creator = (pdfData.info.Creator || '').toLowerCase();
                const isLikelyScanned = 
                  producer.includes('scan') || 
                  creator.includes('scan') || 
                  producer.includes('image') || 
                  creator.includes('image') ||
                  producer.includes('ocr') || 
                  creator.includes('ocr');
                  
                if (isLikelyScanned) {
                  this.logger.warn('PDF metadata suggests this may be a scanned document');
                }
              }
              
              // Check if the PDF extraction was reasonably successful
              if (!textContent || textContent.trim().length === 0) {
                this.logger.warn('PDF parsing yielded empty text, PDF may require OCR');
                textContent = "This PDF requires OCR processing. Please convert it to a text-searchable PDF.";
                
                // Update source status to indicate warning
                await this.prisma.knowledgeBaseSource.update({
                  where: { id: source.id },
                  data: { 
                    indexingStatus: 'WARNING'
                  }
                });
              } else {
                // Additional check for PDFs with very little text (likely scanned)
                const charCount = textContent.length;
                const wordCount = textContent.split(/\s+/).length;
                
                // Calculate average characters per page (rough heuristic)
                const pageCount = pdfData.numpages || 1;
                const charsPerPage = charCount / pageCount;
                
                if (charsPerPage < 100) {
                  this.logger.warn(`Suspiciously low character count per page (${charsPerPage.toFixed(1)}), PDF may be scanned`);
                  
                  // Add warning note to the text content
                  textContent = "Note: This PDF appears to contain very little text and may be a scanned document. OCR processing is recommended.\n\n" + textContent;
                } else {
                  this.logger.debug(`Successfully extracted ${textContent.length} characters (${wordCount} words) from ${pageCount} page PDF`);
                }
                
                // Log sample of extracted text for debugging
                if (textContent.length > 0) {
                  const sampleText = textContent.substring(0, Math.min(500, textContent.length));
                  this.logger.debug(`PDF text sample: "${sampleText}${textContent.length > 500 ? '...' : ''}"`);
                }
              }
            } else {
              this.logger.error('Invalid PDF header, file may be corrupted');
              textContent = "PDF extraction failed - file appears to be corrupted or not a valid PDF.";
              
              await this.prisma.knowledgeBaseSource.update({
                where: { id: source.id },
                data: { 
                  indexingStatus: 'ERROR'
                }
              });
            }
          } catch (pdfError) {
            this.logger.error(`PDF processing failed: ${pdfError.message}`);
            textContent = "PDF processing failed. This document may not be properly indexed.";
            
            // Update source with the specific error information
            await this.prisma.knowledgeBaseSource.update({
              where: { id: source.id },
              data: { 
                indexingStatus: 'ERROR'
              }
            });
          }
        } else {
          // For other file types, attempt basic extraction with warning
          this.logger.warn(`Unsupported file type: ${mimeType}, attempting basic text extraction`);
          textContent = Buffer.from(fileContent).toString('utf-8');
          this.logger.debug(`Basic extraction of ${textContent.length} characters from file of type ${mimeType}`);
        }
      } catch (error) {
        this.logger.warn(`Error extracting text from file: ${error.message}`);
        textContent = `File content for ${source.file.name} (${mimeType})`;
      }
      
      // Sanitize text to ensure it's valid UTF-8
      textContent = this.sanitizeText(textContent);
      
      // 4. Split text into chunks - pass the mime type for specialized handling
      const chunks = await this.chunkingService.splitTextIntoChunks(textContent, mimeType);
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
      const points = chunks.map((chunk, index) => {
        // Generate a proper UUID for each vector point
        const pointId = randomUUID();
        
        return {
          id: pointId,
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
        };
      });
      
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
              organizationId: job.data.organizationId
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
} 