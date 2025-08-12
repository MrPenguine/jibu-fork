import { Module } from '@nestjs/common';
import { FolderController } from './folder.controller';
import { FolderService } from './folder.service';
import { PrismaService } from '../../../core/database/prisma.service';

@Module({
  controllers: [FolderController],
  providers: [FolderService, PrismaService],
})
export class FolderModule {}
