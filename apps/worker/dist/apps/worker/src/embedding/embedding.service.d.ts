import { ConfigService } from '@nestjs/config';
export type EmbeddingProvider = 'gemini' | 'openai';
export interface EmbeddingModelSpec {
    provider: EmbeddingProvider;
    dimension: number;
    maxChunkChars: number;
}
export declare const EMBEDDING_MODELS: Record<string, EmbeddingModelSpec>;
export declare const DEFAULT_EMBEDDING_MODEL = "gemini-embedding-001";
export declare function resolveEmbeddingModel(model?: string | null): {
    model: string;
    spec: EmbeddingModelSpec;
};
export declare class EmbeddingService {
    private readonly configService;
    private readonly logger;
    private readonly genAI;
    private readonly openai;
    private readonly defaultModelName;
    private readonly defaultDimension;
    constructor(configService: ConfigService);
    private resolve;
    getDimension(model?: string | null): number;
    private buildFallbackVector;
    embedDocuments(documents: {
        text: string;
        title?: string;
    }[], opts?: {
        model?: string | null;
    }): Promise<number[][]>;
    embedQuery(queryText: string, opts?: {
        model?: string | null;
    }): Promise<number[]>;
    private geminiEmbedDocuments;
    private openaiEmbed;
    embedText(text: string, opts?: {
        model?: string | null;
    }): Promise<number[]>;
}
