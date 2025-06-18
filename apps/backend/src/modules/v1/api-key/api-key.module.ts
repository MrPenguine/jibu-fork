import { Module } from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { ApiKeyController } from './api-key.controller';
import { DatabaseModule } from '../../../core/database/database.module';
import { EncryptionModule } from '../../../core/encryption/encryption.module';

@Module({
  imports: [DatabaseModule, EncryptionModule],
  providers: [ApiKeyService],
  controllers: [ApiKeyController],
  exports: [ApiKeyService],
})
export class ApiKeyModule {} 