import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Storage
import { S3StorageService } from './storage/providers/s3/s3-storage.service';
import { storageServiceFactory } from './storage/storage.factory';
import { IStorageService } from './storage/interfaces/storage.interface';
import { StorageService } from './storage/storage.service';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    ConfigModule,
    StorageModule,
  ],
  providers: [
    
    // Re-export the storage service interface
    {
      provide: IStorageService,
      useExisting: StorageService
    }
  ],
  exports: [
    // Export interface tokens for other modules to use

    IStorageService,
    
    StorageModule,
  ],
})
export class IntegrationsModule {} 