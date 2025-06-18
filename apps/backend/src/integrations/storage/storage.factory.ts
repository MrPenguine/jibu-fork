import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IStorageService } from './interfaces/storage.interface';
import { S3StorageService } from './providers/s3/s3-storage.service';

/**
 * Factory provider for storage service
 * Based on configured storage provider, returns appropriate storage service instance
 */
export const storageServiceFactory: Provider = {
  provide: IStorageService,
  useFactory: (
    configService: ConfigService,
    s3StorageService: S3StorageService,
  ) => {
    const storageProvider = configService.get<string>('STORAGE_PROVIDER');
    
    switch (storageProvider?.toLowerCase()) {
      case 's3':
        return s3StorageService;
      default:
        throw new Error(`Unsupported storage provider: ${storageProvider}`);
    }
  },
  inject: [ConfigService, S3StorageService],
}; 