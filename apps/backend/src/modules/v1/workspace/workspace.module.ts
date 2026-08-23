import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceService } from './workspace.service';
import { DatabaseModule } from '../../../core/database/database.module';
import { EncryptionModule } from '../../../core/encryption/encryption.module';

@Module({
  imports: [EncryptionModule, ConfigModule, DatabaseModule],
  controllers: [WorkspaceController],
  providers: [WorkspaceService],
  exports: [WorkspaceService]
})
export class WorkspaceModule {}
