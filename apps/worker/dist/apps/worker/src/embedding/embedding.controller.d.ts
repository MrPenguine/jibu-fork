import { EmbeddingService } from './embedding.service';
interface EmbeddingRequest {
    text: string;
}
export declare class EmbeddingController {
    private readonly embeddingService;
    private readonly logger;
    constructor(embeddingService: EmbeddingService);
    generateEmbedding(request: EmbeddingRequest): Promise<{
        error: string;
        success?: undefined;
        embedding?: undefined;
    } | {
        success: boolean;
        embedding: number[];
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        embedding?: undefined;
    }>;
}
export {};
