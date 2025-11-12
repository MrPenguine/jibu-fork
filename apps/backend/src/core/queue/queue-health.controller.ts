import { Controller, Get, Logger } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import Queue from 'bull';
import { QUEUE_NAMES } from '@jibu/queue-definitions';

@ApiTags('queue-health')
@Controller('queue/health')
export class QueueHealthController {
  private readonly logger = new Logger(QueueHealthController.name);

  @Public()
  @Get()
  @ApiOperation({ summary: 'Simple queue health check' })
  async checkHealth() {
    this.logger.log('[DIAGNOSTIC] Performing simple queue health check...');

    try {
      // Create direct connections to check queue health
      const redisConfig = {
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
          password: process.env.REDIS_PASSWORD,
        },
      };

      this.logger.log(`[DIAGNOSTIC] Connecting to Redis at ${redisConfig.redis.host}:${redisConfig.redis.port}`);

      // Test connection to publish queue
      const publishQueue = new Queue(QUEUE_NAMES.WORKFLOW_PUBLISH, redisConfig);
      
      const counts = await publishQueue.getJobCounts();
      const isReady = await publishQueue.isReady();

      await publishQueue.close();

      const result = {
        timestamp: new Date().toISOString(),
        redis: {
          host: redisConfig.redis.host,
          port: redisConfig.redis.port,
          connected: isReady,
        },
        publishQueue: {
          name: QUEUE_NAMES.WORKFLOW_PUBLISH,
          ready: isReady,
          counts,
        },
      };

      this.logger.log(`[DIAGNOSTIC] Health check result: ${JSON.stringify(result, null, 2)}`);
      return result;
    } catch (error) {
      this.logger.error(`[DIAGNOSTIC] ❌ Health check failed: ${error.message}`, error.stack);
      return {
        timestamp: new Date().toISOString(),
        error: error.message,
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
          connected: false,
        },
      };
    }
  }
}
