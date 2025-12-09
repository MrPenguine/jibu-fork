import { IStorageService } from './interfaces/storage.interface';
import { Readable } from 'node:stream';
export declare class StorageService implements IStorageService {
    private readonly storageService;
    private readonly logger;
    constructor(storageService: IStorageService);
    upload(key: string, buffer: Buffer | Uint8Array, mimeType: string, orgId: string): Promise<{
        url: string;
        key: string;
        versionId?: string;
    }>;
    getFileStream(key: string, orgId: string): Promise<Readable>;
    getSignedDownloadUrl(key: string, orgId: string, expiresIn?: number): Promise<string>;
    delete(key: string, orgId: string): Promise<void>;
    checkConnection(): Promise<boolean>;
}
