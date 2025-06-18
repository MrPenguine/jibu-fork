import { Module } from '@nestjs/common';
import { FileService } from './file.service';
import { FileController } from './file.controller';
import { DatabaseModule } from '../../../core/database/database.module';
import { StorageModule } from '../../../integrations/storage/storage.module';

@Module({
  imports: [
    DatabaseModule,
    StorageModule,
  ],
  providers: [FileService],
  controllers: [FileController],
  exports: [FileService],
})
export class FileModule {} 