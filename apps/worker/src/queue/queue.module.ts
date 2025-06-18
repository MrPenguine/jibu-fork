import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QUEUE_NAMES } from '@jibu/queue-definitions';
import { QueueProcessor } from './queue.processor';
import { IndexingProcessor } from './indexing.processor';
import { PrismaService } from '../../../backend/src/core/database/prisma.service';
import { FileService } from '../../../backend/src/modules/v1/file/file.service';
import { DatabaseModule } from '../../../backend/src/core/database/database.module';
import { FileModule } from '../../../backend/src/modules/v1/file/file.module';
import { ChunkingModule } from '../chunking/chunking.module';
import { EmbeddingModule } from '../embedding/embedding.module';
import { VectorDbModule } from '../vector-db/vector-db.module';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD'),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: true,
          removeOnFail: 100,
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.DEFAULT },
      { 
        name: QUEUE_NAMES.INDEXING,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
        limiter: {
          max: 5, // Maximum number of jobs processed in the duration
          duration: 1000, // Duration in milliseconds for rate limiting
        }
      },
    ),
    DatabaseModule,
    FileModule,
    ChunkingModule,
    EmbeddingModule,
    VectorDbModule,
  ],
  providers: [
    QueueProcessor, 
    IndexingProcessor,
  ],
  exports: [BullModule],
})
export class QueueModule {} 