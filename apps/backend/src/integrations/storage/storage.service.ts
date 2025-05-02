import { Inject, Injectable, Logger } from '@nestjs/common';
import { IStorageService } from './interfaces/storage.interface';
import { Readable } from 'node:stream';

@Injectable()
export class StorageService implements IStorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(
    @Inject(IStorageService) private readonly storageService: IStorageService,
  ) {}

  async upload(
    key: string,
    buffer: Buffer | Uint8Array,
    mimeType: string,
    orgId: string,
  ): Promise<{ url: string; key: string; versionId?: string }> {
    return this.storageService.upload(key, buffer, mimeType, orgId);
  }

  async getFileStream(key: string, orgId: string): Promise<Readable> {
    return this.storageService.getFileStream(key, orgId);
  }

  async getSignedDownloadUrl(
    key: string,
    orgId: string,
    expiresIn?: number,
  ): Promise<string> {
    return this.storageService.getSignedDownloadUrl(key, orgId, expiresIn);
  }

  async delete(key: string, orgId: string): Promise<void> {
    return this.storageService.delete(key, orgId);
  }

  async checkConnection(): Promise<boolean> {
    this.logger.log('Checking storage connection via storage service');
    try {
      const result = await this.storageService.checkConnection();
      this.logger.log(`Storage connection result: ${result}`);
      return result;
    } catch (error) {
      this.logger.error(`Storage connection check error: ${error.message}`);
      throw error;
    }
  }
} 