import { VectorDbService } from './vector-db.service';
interface SearchRequest {
    vector: number[];
    limit?: number;
    filter?: any;
}
export declare class VectorDbController {
    private readonly vectorDbService;
    private readonly logger;
    constructor(vectorDbService: VectorDbService);
    search(collection: string, request: SearchRequest): Promise<{
        error: string;
        success?: undefined;
        results?: undefined;
    } | {
        success: boolean;
        results: import("./vector-db.service").SearchResult[];
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        results?: undefined;
    }>;
}
export {};
