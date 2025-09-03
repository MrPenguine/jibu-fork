import { Module } from '@nestjs/common';
import { UserSyncService } from './sync.service';
import { DatabaseModule } from '../database/database.module';
import { ApiKeyModule } from '../../modules/v1/api-key/api-key.module';

@Module({
  imports: [DatabaseModule, ApiKeyModule],
  providers: [UserSyncService],
  exports: [UserSyncService],
})
export class SyncModule {}
