import { Job } from 'bull';
import { PrismaService } from '../../../backend/src/core/database/prisma.service';
import { FileService } from '../../../backend/src/modules/v1/file/file.service';
import { ChunkingService } from '../chunking/chunking.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { VectorDbService } from '../vector-db/vector-db.service';
import { IndexFileSourceJobData, DeindexSourceJobData } from '@jibu/queue-definitions';
import { Queue } from 'bull';
export declare class IndexingProcessor {
    private readonly prisma;
    private readonly fileService;
    private readonly chunkingService;
    private readonly embeddingService;
    private readonly vectorDbService;
    private readonly indexingQueue;
    private readonly logger;
    constructor(prisma: PrismaService, fileService: FileService, chunkingService: ChunkingService, embeddingService: EmbeddingService, vectorDbService: VectorDbService, indexingQueue: Queue);
    processIndexFileSource(job: Job<IndexFileSourceJobData>): Promise<{
        success: boolean;
        jobId: import("bull").JobId;
        knowledgeBaseId: string;
        sourceId: string;
        chunks: number;
        vectors: number;
        storedMetadata: number;
    }>;
    processDeindexSource(job: Job<DeindexSourceJobData>): Promise<{
        success: boolean;
        jobId: import("bull").JobId;
        knowledgeBaseSourceId: string;
        sourceType: string;
    }>;
    private sanitizeText;
}
