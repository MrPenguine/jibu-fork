import { Module } from '@nestjs/common';
import { FolderController } from './folder.controller';
import { FolderService } from './folder.service';
import { DatabaseModule } from '../../../core/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [FolderController],
  providers: [FolderService],
})
export class FolderModule {}
