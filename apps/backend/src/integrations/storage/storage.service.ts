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
    this.logger.log(`StorageService: Uploading file for organization ${orgId}`);
    this.logger.log(`StorageService: Key: ${key}, Size: ${buffer.byteLength} bytes, MimeType: ${mimeType}`);
    
    try {
      const result = await this.storageService.upload(key, buffer, mimeType, orgId);
      this.logger.log(`StorageService: Upload successful for organization ${orgId}, final key: ${result.key}`);
      return result;
    } catch (error) {
      this.logger.error(`StorageService: Upload failed for organization ${orgId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getFileStream(key: string, orgId: string): Promise<Readable> {
    this.logger.log(`StorageService: Getting file stream for organization ${orgId}, key: ${key}`);
    try {
      return await this.storageService.getFileStream(key, orgId);
    } catch (error) {
      this.logger.error(`StorageService: Failed to get file stream for organization ${orgId}, key: ${key}`, error.stack);
      throw error;
    }
  }

  async getSignedDownloadUrl(
    key: string,
    orgId: string,
    expiresIn?: number,
  ): Promise<string> {
    this.logger.log(`StorageService: Generating signed URL for organization ${orgId}, key: ${key}`);
    try {
      const url = await this.storageService.getSignedDownloadUrl(key, orgId, expiresIn);
      this.logger.log(`StorageService: Successfully generated signed URL for organization ${orgId}`);
      return url;
    } catch (error) {
      this.logger.error(`StorageService: Failed to generate signed URL for organization ${orgId}`, error.stack);
      throw error;
    }
  }

  async delete(key: string, orgId: string): Promise<void> {
    this.logger.log(`StorageService: Deleting file for organization ${orgId}, key: ${key}`);
    try {
      await this.storageService.delete(key, orgId);
      this.logger.log(`StorageService: Successfully deleted file for organization ${orgId}`);
    } catch (error) {
      this.logger.error(`StorageService: Failed to delete file for organization ${orgId}`, error.stack);
      throw error;
    }
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