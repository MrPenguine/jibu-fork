import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QUEUE_NAMES } from '@jibu/queue-definitions';
import { QueueService } from './queue.service';
import { QueueProcessor } from './queue.processor';
import { IndexingProcessor } from './indexing.processor';
import { QueueController } from './queue.controller';

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
      { name: QUEUE_NAMES.INDEXING },
    ),
  ],
  controllers: [QueueController],
  providers: [QueueService, QueueProcessor, IndexingProcessor],
  exports: [BullModule, QueueService],
})
export class QueueModule {} 