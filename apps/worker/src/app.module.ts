import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../../backend/src/core/database/database.module';
import { StorageModule } from '../../backend/src/integrations/storage/storage.module';
import { FileModule } from '../../backend/src/modules/v1/file/file.module';
import { QueueModule } from './queue/queue.module';
import { ChunkingModule } from './chunking/chunking.module';
import { EmbeddingModule } from './embedding/embedding.module';
import { VectorDbModule } from './vector-db/vector-db.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    DatabaseModule,
    StorageModule,
    FileModule,
    QueueModule,
    ChunkingModule,
    EmbeddingModule,
    VectorDbModule,
  ],
})
export class AppModule {} 