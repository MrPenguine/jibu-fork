import { ConfigService } from '@nestjs/config';
export declare class EmbeddingService {
    private readonly configService;
    private readonly logger;
    private generativeModel;
    private modelName;
    private vectorDimension;
    constructor(configService: ConfigService);
    embedDocuments(documents: {
        text: string;
        title?: string;
    }[]): Promise<number[][]>;
    embedQuery(queryText: string): Promise<number[]>;
    embedText(text: string): Promise<number[]>;
}
