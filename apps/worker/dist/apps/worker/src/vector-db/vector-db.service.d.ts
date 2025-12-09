import { ConfigService } from '@nestjs/config';
export interface VectorEntry {
    id: string;
    vector: number[];
    payload: Record<string, any>;
}
export interface SearchResult {
    id: string;
    score: number;
    vector?: number[];
    payload?: Record<string, any>;
}
export declare class VectorDbService {
    private readonly configService;
    private readonly logger;
    private readonly qdrantUrl;
    constructor(configService: ConfigService);
    getCollections(): Promise<{
        collections: {
            name: string;
        }[];
    }>;
    createCollection(name: string, options: {
        vectors: {
            size: number;
            distance: string;
        };
        optimizers_config?: any;
        replication_factor?: number;
    }): Promise<void>;
    ensureCollection(name: string, vectorSize?: number): Promise<void>;
    upsert(collection: string, data: {
        points: VectorEntry[];
        wait?: boolean;
    }): Promise<void>;
    collectionExists(name: string): Promise<boolean>;
    delete(collection: string, filter: {
        filter?: {
            must?: Array<{
                key: string;
                match: {
                    value: any;
                };
            }>;
        };
        wait?: boolean;
    }): Promise<void>;
    search(collection: string, query: {
        vector: number[];
        limit: number;
        with_payload?: boolean;
        with_vector?: boolean;
        filter?: any;
    }): Promise<SearchResult[]>;
    scroll(collection: string, options?: {
        limit?: number;
        offset?: number;
        with_payload?: boolean;
        with_vector?: boolean;
        filter?: any;
    }): Promise<SearchResult[]>;
    deleteCollection(name: string): Promise<boolean>;
}
