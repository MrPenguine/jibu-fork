import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { S3StorageService } from './providers/s3/s3-storage.service';
import { storageServiceFactory } from './storage.factory';
import { StorageService } from './storage.service';
import { IStorageService } from './interfaces/storage.interface';

@Module({
  imports: [
    ConfigModule,
  ],
  providers: [
    S3StorageService,
    storageServiceFactory,
    StorageService,
  ],
  exports: [
    StorageService,
    IStorageService,
  ],
})
export class StorageModule {} 