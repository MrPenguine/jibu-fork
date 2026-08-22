import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceService } from './workspace.service';
import { DatabaseModule } from '../../../core/database/database.module';
import { ApiKeyModule } from '../api-key/api-key.module';
import { EncryptionModule } from '../../../core/encryption/encryption.module';

@Module({
  imports: [ApiKeyModule, EncryptionModule, ConfigModule, ScheduleModule.forRoot(), DatabaseModule],
  controllers: [WorkspaceController],
  providers: [WorkspaceService],
  exports: [WorkspaceService]
})
export class WorkspaceModule {}
