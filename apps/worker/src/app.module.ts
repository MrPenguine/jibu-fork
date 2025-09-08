import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from '../../backend/src/core/database/database.module';
import { StorageModule } from '../../backend/src/integrations/storage/storage.module';
import { FileModule } from '../../backend/src/modules/v1/file/file.module';
import { QueueModule } from './queue/queue.module';
import { ChunkingModule } from './chunking/chunking.module';
import { EmbeddingModule } from './embedding/embedding.module';
import { VectorDbModule } from './vector-db/vector-db.module';
import { BullModule } from '@nestjs/bull';
import { QUEUE_NAMES } from '@jibu/queue-definitions';
import { N8nModule } from './n8n/n8n.module';
import { ScalingModule } from './scaling/scaling.module';
import { CommonModule } from './common/common.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      cache: true,
    }),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST') || 'localhost',
          port: parseInt(configService.get('REDIS_PORT') || '6379', 10),
          password: configService.get('REDIS_PASSWORD'),
        },
      }),
    }),
    BullModule.registerQueue(
      {
        name: QUEUE_NAMES.INDEXING,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential', 
            delay: 2000
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
        limiter: {
          max: 5, // Maximum number of jobs processed in the duration
          duration: 1000, // Duration in milliseconds for rate limiting
        },
      },
      {
        name: QUEUE_NAMES.WORKFLOW_EXECUTION,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
        limiter: {
          max: 10, // Maximum number of workflow jobs processed in the duration
          duration: 1000, // Duration in milliseconds for rate limiting
        },
      },
      {
        name: QUEUE_NAMES.WORKFLOW_PUBLISH,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
        limiter: {
          max: 5,
          duration: 1000,
        },
      }
    ),
    DatabaseModule,
    StorageModule,
    FileModule,
    QueueModule,
    ChunkingModule,
    EmbeddingModule,
    VectorDbModule,
    N8nModule,
    ScalingModule,
    CommonModule,
  ],
})
export class AppModule {}