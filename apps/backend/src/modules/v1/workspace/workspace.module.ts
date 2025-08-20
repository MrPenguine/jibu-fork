import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceService } from './workspace.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { ApiKeyModule } from '../api-key/api-key.module';
import { EncryptionModule } from '../../../core/encryption/encryption.module';

@Module({
  imports: [ApiKeyModule, EncryptionModule, ConfigModule, ScheduleModule.forRoot()],
  controllers: [WorkspaceController],
  providers: [WorkspaceService, PrismaService],
  exports: [WorkspaceService]
})
export class WorkspaceModule {}
