export declare class ChunkingService {
    private readonly logger;
    private readonly textSplitter;
    private readonly pdfSplitter;
    constructor();
    splitTextIntoChunks(text: string, mimeType?: string): Promise<string[]>;
    private postProcessPdfChunk;
    private splitByLength;
    private containsPdfPatterns;
    private containsBinaryPatterns;
    setChunkParameters(chunkSize: number, chunkOverlap: number): void;
}
