import { Readable } from 'node:stream';
export declare const IStorageService: unique symbol;
export interface IStorageService {
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
