"use strict";
var IndexingProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.IndexingProcessor = void 0;
const tslib_1 = require("tslib");
const bull_1 = require("@nestjs/bull");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../backend/src/core/database/prisma.service");
const file_service_1 = require("../../../backend/src/modules/v1/file/file.service");
const chunking_service_1 = require("../chunking/chunking.service");
const embedding_service_1 = require("../embedding/embedding.service");
const vector_db_service_1 = require("../vector-db/vector-db.service");
const axios_1 = require("axios");
const queue_definitions_1 = require("@jibu/queue-definitions");
const crypto_1 = require("crypto");
const bull_2 = require("@nestjs/bull");
let IndexingProcessor = IndexingProcessor_1 = class IndexingProcessor {
    constructor(prisma, fileService, chunkingService, embeddingService, vectorDbService, indexingQueue) {
        this.prisma = prisma;
        this.fileService = fileService;
        this.chunkingService = chunkingService;
        this.embeddingService = embeddingService;
        this.vectorDbService = vectorDbService;
        this.indexingQueue = indexingQueue;
        this.logger = new common_1.Logger(IndexingProcessor_1.name);
        global['BULL_INDEXING_QUEUE'] = this.indexingQueue;
        const concurrency = parseInt(process.env.INDEXING_CONCURRENCY || '2', 10);
        this.logger.log(`Indexing processor initialized with target concurrency: ${concurrency}`);
    }
    async processIndexFileSource(job) {
        this.logger.debug(`Processing index job ${job.id} for source: ${job.data.knowledgeBaseSourceId} in org: ${job.data.organizationId}`);
        try {
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
            await this.prisma.knowledgeBaseSource.update({
                where: { id: source.id },
                data: { indexingStatus: 'PROCESSING' }
            });
            const downloadUrl = await this.fileService.getDownloadUrl(source.file.id, source.file.workspaceId);
            this.logger.debug(`Got signed download URL for file: ${source.file.name}`);
            const response = await axios_1.default.get(downloadUrl, {
                responseType: 'arraybuffer'
            });
            const fileContent = response.data;
            this.logger.debug(`Downloaded file content, size: ${fileContent.length} bytes`);
            const mimeType = source.file.mimeType;
            let textContent = '';
            try {
                if (mimeType.startsWith('text/')) {
                    textContent = Buffer.from(fileContent).toString('utf-8');
                    this.logger.debug(`Extracted ${textContent.length} characters of text content from file`);
                }
                else if (mimeType.includes('pdf')) {
                    try {
                        const pdfParse = require('pdf-parse');
                        this.logger.debug('Using pdf-parse library for PDF extraction');
                        const fileContentBuffer = Buffer.from(fileContent);
                        const header = fileContentBuffer.slice(0, 5).toString();
                        if (header.startsWith('%PDF-')) {
                            this.logger.debug('Valid PDF header detected');
                            const pdfData = await pdfParse(fileContentBuffer);
                            textContent = pdfData.text || '';
                            if (pdfData.info) {
                                this.logger.debug(`PDF Info: Pages=${pdfData.numpages}, Version=${pdfData.info.PDFFormatVersion || 'unknown'}`);
                                const producer = (pdfData.info.Producer || '').toLowerCase();
                                const creator = (pdfData.info.Creator || '').toLowerCase();
                                const isLikelyScanned = producer.includes('scan') ||
                                    creator.includes('scan') ||
                                    producer.includes('image') ||
                                    creator.includes('image') ||
                                    producer.includes('ocr') ||
                                    creator.includes('ocr');
                                if (isLikelyScanned) {
                                    this.logger.warn('PDF metadata suggests this may be a scanned document');
                                }
                            }
                            if (!textContent || textContent.trim().length === 0) {
                                this.logger.warn('PDF parsing yielded empty text, PDF may require OCR');
                                textContent = "This PDF requires OCR processing. Please convert it to a text-searchable PDF.";
                                await this.prisma.knowledgeBaseSource.update({
                                    where: { id: source.id },
                                    data: {
                                        indexingStatus: 'WARNING'
                                    }
                                });
                            }
                            else {
                                const charCount = textContent.length;
                                const wordCount = textContent.split(/\s+/).length;
                                const pageCount = pdfData.numpages || 1;
                                const charsPerPage = charCount / pageCount;
                                if (charsPerPage < 100) {
                                    this.logger.warn(`Suspiciously low character count per page (${charsPerPage.toFixed(1)}), PDF may be scanned`);
                                    textContent = "Note: This PDF appears to contain very little text and may be a scanned document. OCR processing is recommended.\n\n" + textContent;
                                }
                                else {
                                    this.logger.debug(`Successfully extracted ${textContent.length} characters (${wordCount} words) from ${pageCount} page PDF`);
                                }
                                if (textContent.length > 0) {
                                    const sampleText = textContent.substring(0, Math.min(500, textContent.length));
                                    this.logger.debug(`PDF text sample: "${sampleText}${textContent.length > 500 ? '...' : ''}"`);
                                }
                            }
                        }
                        else {
                            this.logger.error('Invalid PDF header, file may be corrupted');
                            textContent = "PDF extraction failed - file appears to be corrupted or not a valid PDF.";
                            await this.prisma.knowledgeBaseSource.update({
                                where: { id: source.id },
                                data: {
                                    indexingStatus: 'ERROR'
                                }
                            });
                        }
                    }
                    catch (pdfError) {
                        this.logger.error(`PDF processing failed: ${pdfError.message}`);
                        textContent = "PDF processing failed. This document may not be properly indexed.";
                        await this.prisma.knowledgeBaseSource.update({
                            where: { id: source.id },
                            data: {
                                indexingStatus: 'ERROR'
                            }
                        });
                    }
                }
                else {
                    this.logger.warn(`Unsupported file type: ${mimeType}, attempting basic text extraction`);
                    textContent = Buffer.from(fileContent).toString('utf-8');
                    this.logger.debug(`Basic extraction of ${textContent.length} characters from file of type ${mimeType}`);
                }
            }
            catch (error) {
                this.logger.warn(`Error extracting text from file: ${error.message}`);
                textContent = `File content for ${source.file.name} (${mimeType})`;
            }
            textContent = this.sanitizeText(textContent);
            const chunks = await this.chunkingService.splitTextIntoChunks(textContent, mimeType);
            this.logger.debug(`Split text into ${chunks.length} chunks`);
            if (chunks.length > 0) {
                this.logger.debug(`Sample chunk (1/${chunks.length}): "${chunks[0].substring(0, 200)}${chunks[0].length > 200 ? '...' : ''}"`);
                if (chunks.length > 1) {
                    this.logger.debug(`Sample chunk (2/${chunks.length}): "${chunks[1].substring(0, 200)}${chunks[1].length > 200 ? '...' : ''}"`);
                }
            }
            const collectionName = `kb_${source.knowledgeBaseId}`;
            await this.vectorDbService.ensureCollection(collectionName);
            const embeddings = await this.embeddingService.embedDocuments(chunks.map(chunk => ({ text: chunk })));
            this.logger.debug(`Generated ${embeddings.length} embeddings`);
            if (embeddings.length > 0) {
                this.logger.debug(`Sample embedding (1/${embeddings.length}): [${embeddings[0].slice(0, 5).join(', ')}${embeddings[0].length > 5 ? '...' : ''}], dimension: ${embeddings[0].length}`);
            }
            const points = chunks.map((chunk, index) => {
                const pointId = (0, crypto_1.randomUUID)();
                return {
                    id: pointId,
                    vector: embeddings[index],
                    payload: {
                        text: chunk,
                        sourceId: source.id,
                        fileId: source.sourcePointer,
                        fileName: source.file.name,
                        knowledgeBaseId: source.knowledgeBaseId,
                        organizationId: job.data.organizationId,
                        workspaceId: source.file.workspaceId,
                        chunkIndex: index
                    }
                };
            });
            await this.vectorDbService.upsert(collectionName, { points });
            this.logger.debug(`Stored ${points.length} vector points in collection ${collectionName}`);
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
            this.logger.debug(`Storing ${points.length} chunk metadata records in batches`);
            try {
                const sourceExists = await this.prisma.knowledgeBaseSource.findUnique({
                    where: { id: source.id }
                });
                if (!sourceExists) {
                    this.logger.error(`Source ${source.id} not found in database before creating chunk metadata. Aborting.`);
                    throw new Error(`Source ${source.id} was deleted during processing`);
                }
            }
            catch (error) {
                this.logger.error(`Error verifying source: ${error.message}`);
                throw error;
            }
            const chunkMetadataData = points.map((point, index) => {
                const sanitizedText = chunks[index]
                    .replace(/[\x00-\x09\x0B-\x1F\x7F-\x9F]/g, '')
                    .replace(/\\x[0-9a-fA-F]?(?![0-9a-fA-F])/g, '')
                    .replace(/\\u[0-9a-fA-F]{0,3}(?![0-9a-fA-F])/g, '')
                    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
                const textPreview = sanitizedText.substring(0, 100);
                return {
                    knowledgeBaseId: source.knowledgeBaseId,
                    sourceId: source.id,
                    chunkIndex: index,
                    vectorId: point.id,
                    textPreview: textPreview,
                    textLength: sanitizedText.length,
                };
            });
            const BATCH_SIZE = 25;
            let successfulBatches = 0;
            let failedBatches = 0;
            let totalSuccessfulItems = 0;
            let consecutiveFailedBatches = 0;
            const MAX_CONSECUTIVE_FAILED_BATCHES = 5;
            for (let i = 0; i < chunkMetadataData.length; i += BATCH_SIZE) {
                const batch = chunkMetadataData.slice(i, i + BATCH_SIZE);
                const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
                const totalBatches = Math.ceil(chunkMetadataData.length / BATCH_SIZE);
                this.logger.debug(`Processing chunk metadata batch ${batchNumber} of ${totalBatches}`);
                try {
                    const sourceStillExists = await this.prisma.knowledgeBaseSource.findUnique({
                        where: { id: source.id }
                    });
                    if (!sourceStillExists) {
                        this.logger.error(`Source ${source.id} no longer exists. Aborting metadata creation.`);
                        throw new Error('Source was deleted during processing');
                    }
                    let batchSuccessCount = 0;
                    for (let j = 0; j < batch.length; j++) {
                        try {
                            await this.prisma.chunkMetadata.create({
                                data: batch[j]
                            });
                            batchSuccessCount++;
                            totalSuccessfulItems++;
                        }
                        catch (itemError) {
                            if (itemError.message.includes('Foreign key constraint')) {
                                this.logger.warn(`Foreign key constraint error for item ${j} in batch ${batchNumber}: Source may have been deleted`);
                                throw new Error('Source reference lost during processing');
                            }
                            else {
                                this.logger.warn(`Failed to create chunk metadata for item ${j} in batch ${batchNumber}: ${itemError.message}`);
                            }
                        }
                    }
                    if (batchSuccessCount > 0) {
                        successfulBatches++;
                        consecutiveFailedBatches = 0;
                    }
                    else {
                        failedBatches++;
                        consecutiveFailedBatches++;
                        if (consecutiveFailedBatches >= MAX_CONSECUTIVE_FAILED_BATCHES) {
                            this.logger.error(`${MAX_CONSECUTIVE_FAILED_BATCHES} consecutive batches failed. Aborting.`);
                            throw new Error(`Excessive consecutive batch failures: ${consecutiveFailedBatches}`);
                        }
                    }
                    if (i + BATCH_SIZE < chunkMetadataData.length) {
                        this.logger.debug('Pausing briefly between batches to manage connection pool');
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }
                catch (error) {
                    this.logger.error(`Error processing batch ${batchNumber}: ${error.message}`);
                    failedBatches++;
                    consecutiveFailedBatches++;
                    if (error.message.includes('Source') ||
                        error.message.includes('Foreign key constraint') ||
                        consecutiveFailedBatches >= MAX_CONSECUTIVE_FAILED_BATCHES) {
                        this.logger.error('Critical error detected, aborting further processing');
                        break;
                    }
                    if (i + BATCH_SIZE < chunkMetadataData.length) {
                        this.logger.debug('Continuing with next batch after error');
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            }
            this.logger.log(`Chunk metadata processing completed. Success: ${successfulBatches}/${Math.ceil(chunkMetadataData.length / BATCH_SIZE)} batches, ${totalSuccessfulItems}/${chunkMetadataData.length} items`);
            if (totalSuccessfulItems > 0) {
                this.logger.debug(`Stored ${totalSuccessfulItems} chunk metadata records successfully`);
            }
            else {
                throw new Error("Failed to store any chunk metadata records");
            }
            try {
                if (totalSuccessfulItems === 0) {
                    throw new Error('No vectors were successfully stored');
                }
                const chunkCount = await this.prisma.chunkMetadata.count({
                    where: {
                        sourceId: source.id
                    }
                });
                this.logger.log(`Found ${chunkCount} chunk metadata records for source ${source.id}`);
                await this.prisma.knowledgeBaseSource.update({
                    where: { id: source.id },
                    data: {
                        indexingStatus: chunkCount > 0 ? 'COMPLETED' : 'FAILED',
                        hasIndexedContent: chunkCount > 0
                    }
                });
                const allSources = await this.prisma.knowledgeBaseSource.findMany({
                    where: { knowledgeBaseId: source.knowledgeBaseId },
                    select: {
                        id: true,
                        indexingStatus: true
                    }
                });
                this.logger.debug(`Source statuses for knowledge base ${source.knowledgeBaseId}: ${JSON.stringify(allSources.map(s => ({ id: s.id, status: s.indexingStatus })))}`);
                const stillProcessing = allSources.some(s => s.id !== source.id &&
                    (s.indexingStatus === 'PROCESSING' || s.indexingStatus === 'PENDING'));
                if (stillProcessing) {
                    this.logger.debug(`Other sources still processing in knowledge base ${source.knowledgeBaseId}`);
                }
                else {
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
            }
            catch (error) {
                this.logger.error(`Error updating source status: ${error.message}`);
                try {
                    await this.prisma.knowledgeBaseSource.update({
                        where: { id: source.id },
                        data: {
                            indexingStatus: 'FAILED',
                            hasIndexedContent: false
                        }
                    });
                }
                catch (updateError) {
                    this.logger.error(`Failed to mark source as failed: ${updateError.message}`);
                }
                throw error;
            }
        }
        catch (error) {
            this.logger.error(`Error processing indexing job ${job.id}: ${error.message}`, error.stack);
            try {
                await this.prisma.knowledgeBaseSource.update({
                    where: { id: job.data.knowledgeBaseSourceId },
                    data: { indexingStatus: 'ERROR' }
                });
            }
            catch (updateError) {
                this.logger.error(`Failed to update source status: ${updateError.message}`);
            }
            throw error;
        }
    }
    async processDeindexSource(job) {
        this.logger.debug(`Processing deindex job ${job.id} for source: ${job.data.knowledgeBaseSourceId}, type: ${job.data.sourceType}`);
        try {
            let knowledgeBaseId = '';
            if (job.data.knowledgeBaseId) {
                this.logger.debug(`Using knowledgeBaseId from job data: ${job.data.knowledgeBaseId}`);
                knowledgeBaseId = job.data.knowledgeBaseId;
            }
            else {
                this.logger.debug(`No knowledgeBaseId in job data, trying to get it from database`);
                try {
                    const source = await this.prisma.knowledgeBaseSource.findUnique({
                        where: { id: job.data.knowledgeBaseSourceId }
                    });
                    if (source) {
                        knowledgeBaseId = source.knowledgeBaseId;
                        this.logger.debug(`Found knowledgeBaseId from database: ${knowledgeBaseId}`);
                    }
                }
                catch (error) {
                    this.logger.warn(`Source ${job.data.knowledgeBaseSourceId} not found, proceeding with deindexing anyway`);
                }
            }
            if (!knowledgeBaseId) {
                throw new Error('Knowledge base ID not found for source');
            }
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
            this.logger.debug(`Source statuses: ${JSON.stringify(allSources.map(s => ({ id: s.id, status: s.indexingStatus })))}`);
            const otherActiveSourcesCount = allSources.filter(s => s.id !== job.data.knowledgeBaseSourceId &&
                ['COMPLETED', 'PROCESSING', 'PENDING'].includes(s.indexingStatus)).length;
            this.logger.debug(`Other active sources count: ${otherActiveSourcesCount}`);
            const collectionName = `kb_${knowledgeBaseId}`;
            const collectionExists = await this.vectorDbService.collectionExists(collectionName);
            if (collectionExists) {
                try {
                    if (otherActiveSourcesCount === 0) {
                        this.logger.debug(`No other active sources, deleting collection ${collectionName}`);
                        const deleted = await this.vectorDbService.deleteCollection(collectionName);
                        if (deleted) {
                            this.logger.debug(`Successfully deleted collection ${collectionName}`);
                        }
                        else {
                            this.logger.warn(`Failed to delete collection ${collectionName}`);
                        }
                    }
                    else {
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
                        }
                        catch (deleteError) {
                            this.logger.error(`Error deleting vectors: ${deleteError.message}`, deleteError.stack);
                        }
                    }
                    await this.prisma.chunkMetadata.deleteMany({
                        where: { sourceId: job.data.knowledgeBaseSourceId }
                    });
                    this.logger.debug(`Deleted chunk metadata for source ${job.data.knowledgeBaseSourceId}`);
                    const sourceExists = await this.prisma.knowledgeBaseSource.findUnique({
                        where: { id: job.data.knowledgeBaseSourceId }
                    });
                    if (sourceExists) {
                        await this.prisma.knowledgeBaseSource.update({
                            where: { id: job.data.knowledgeBaseSourceId },
                            data: {
                                hasIndexedContent: false,
                                indexingStatus: 'PENDING'
                            }
                        });
                        this.logger.debug(`Updated hasIndexedContent flag for source ${job.data.knowledgeBaseSourceId}`);
                        const indexingJobData = {
                            knowledgeBaseSourceId: job.data.knowledgeBaseSourceId,
                            organizationId: job.data.organizationId
                        };
                        await this.indexingQueue.add(queue_definitions_1.JOB_NAMES.INDEX_FILE_SOURCE, indexingJobData, {
                            attempts: 3,
                            backoff: { type: 'exponential', delay: 2000 },
                            priority: 1
                        });
                        this.logger.debug(`Added reindex job for source ${job.data.knowledgeBaseSourceId} to queue`);
                    }
                    else {
                        this.logger.warn(`Source ${job.data.knowledgeBaseSourceId} no longer exists, skipping update`);
                    }
                }
                catch (error) {
                    this.logger.error(`Error handling collection deletion: ${error.message}`, error.stack);
                }
            }
            else {
                this.logger.warn(`Collection ${collectionName} not found, skipping deletion`);
                await this.prisma.chunkMetadata.deleteMany({
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
        }
        catch (error) {
            this.logger.error(`Error processing deindex job ${job.id}: ${error.message}`, error.stack);
            throw error;
        }
    }
    sanitizeText(text) {
        if (!text)
            return '';
        try {
            let sanitized = text
                .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
                .replace(/\r\n?/g, '\n')
                .replace(/[ \t]+/g, ' ')
                .replace(/\uFFFD/g, ' ');
            if (sanitized.length > 1000000) {
                this.logger.warn(`Text too long (${sanitized.length} chars), truncating to 1M chars`);
                sanitized = sanitized.substring(0, 1000000);
            }
            return sanitized;
        }
        catch (error) {
            this.logger.error(`Error sanitizing text: ${error.message}`);
            return `Unprocessable content (sanitization error: ${error.message})`;
        }
    }
};
exports.IndexingProcessor = IndexingProcessor;
tslib_1.__decorate([
    (0, bull_1.Process)(queue_definitions_1.JOB_NAMES.INDEX_FILE_SOURCE),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [Object]),
    tslib_1.__metadata("design:returntype", Promise)
], IndexingProcessor.prototype, "processIndexFileSource", null);
tslib_1.__decorate([
    (0, bull_1.Process)(queue_definitions_1.JOB_NAMES.DEINDEX_SOURCE),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [Object]),
    tslib_1.__metadata("design:returntype", Promise)
], IndexingProcessor.prototype, "processDeindexSource", null);
exports.IndexingProcessor = IndexingProcessor = IndexingProcessor_1 = tslib_1.__decorate([
    (0, common_1.Injectable)(),
    (0, bull_1.Processor)(queue_definitions_1.QUEUE_NAMES.INDEXING),
    tslib_1.__param(5, (0, bull_2.InjectQueue)(queue_definitions_1.QUEUE_NAMES.INDEXING)),
    tslib_1.__metadata("design:paramtypes", [prisma_service_1.PrismaService,
        file_service_1.FileService,
        chunking_service_1.ChunkingService,
        embedding_service_1.EmbeddingService,
        vector_db_service_1.VectorDbService, Object])
], IndexingProcessor);
//# sourceMappingURL=indexing.processor.js.map