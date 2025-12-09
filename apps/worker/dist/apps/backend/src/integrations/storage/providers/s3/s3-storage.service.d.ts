import { ConfigService } from '@nestjs/config';
import { IStorageService } from '../../interfaces/storage.interface';
import type { Readable } from 'stream';
export declare class S3StorageService implements IStorageService {
    private readonly configService;
    private readonly logger;
    private readonly s3Client;
    private readonly bucketName;
    private readonly region;
    constructor(configService: ConfigService);
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
