import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QUEUE_NAMES } from '@jibu/queue-definitions';
import { QueueService } from './queue.service';
import { QueueProcessor } from './queue.processor';
import { QueueController } from './queue.controller';
import { QueueMonitorController } from './queue-monitor.controller';
import { QueueHealthController } from './queue-health.controller';

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
      { name: QUEUE_NAMES.WORKFLOW_PUBLISH },
      { 
        name: QUEUE_NAMES.WEBHOOK_DELIVERY,
        // Voice-optimized settings
        defaultJobOptions: {
          attempts: 2, // Only 2 retries to prevent dead air
          backoff: {
            type: 'exponential',
            delay: 500, // Fast retry for voice (500ms)
          },
          timeout: 5000, // 5-second timeout for voice requirement
          removeOnComplete: true,
          removeOnFail: 100,
        },
        limiter: {
          max: 15, // 15 jobs per second (rate limiting)
          duration: 1000,
        },
        settings: {
          maxStalledCount: 1, // Fail fast to prevent dead air
          stalledInterval: 5000, // Check for stalled jobs every 5 seconds
        },
      },
    ),
  ],
  controllers: [QueueController, QueueMonitorController, QueueHealthController],
  providers: [QueueService, QueueProcessor],
  exports: [BullModule, QueueService],
})
export class QueueModule {}