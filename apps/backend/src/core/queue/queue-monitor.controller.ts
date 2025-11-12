import { Controller, Get, Logger } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { QueueService } from './queue.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { QUEUE_NAMES } from '@jibu/queue-definitions';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('queue-monitoring')
@Controller('queue/monitor')
export class QueueMonitorController {
  private readonly logger = new Logger(QueueMonitorController.name);

  constructor(
    private readonly queueService: QueueService,
    @InjectQueue(QUEUE_NAMES.DEFAULT) private readonly defaultQueue: Queue,
    @InjectQueue(QUEUE_NAMES.INDEXING) private readonly indexingQueue: Queue,
    @InjectQueue(QUEUE_NAMES.WORKFLOW_PUBLISH) private readonly publishQueue: Queue,
  ) {}

  @Public()
  @Get('status')
  @ApiOperation({ summary: 'Get status of all queues for diagnostics' })
  async getQueueStatus() {
    this.logger.log('[DIAGNOSTIC] Checking queue status...');

    try {
      const defaultCounts = await this.defaultQueue.getJobCounts();
      const indexingCounts = await this.indexingQueue.getJobCounts();
      const publishCounts = await this.publishQueue.getJobCounts();

      const defaultHealth = await this.defaultQueue.isReady();
      const indexingHealth = await this.indexingQueue.isReady();
      const publishHealth = await this.publishQueue.isReady();

      const result = {
        timestamp: new Date().toISOString(),
        queues: {
          [QUEUE_NAMES.DEFAULT]: {
            name: QUEUE_NAMES.DEFAULT,
            healthy: defaultHealth,
            counts: defaultCounts,
          },
          [QUEUE_NAMES.INDEXING]: {
            name: QUEUE_NAMES.INDEXING,
            healthy: indexingHealth,
            counts: indexingCounts,
          },
          [QUEUE_NAMES.WORKFLOW_PUBLISH]: {
            name: QUEUE_NAMES.WORKFLOW_PUBLISH,
            healthy: publishHealth,
            counts: publishCounts,
          },
        },
      };

      this.logger.log(`[DIAGNOSTIC] Queue status: ${JSON.stringify(result, null, 2)}`);
      return result;
    } catch (error) {
      this.logger.error(`[DIAGNOSTIC] ❌ Failed to get queue status: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Public()
  @Get('publish-queue/jobs')
  @ApiOperation({ summary: 'Get recent jobs from publish queue' })
  async getPublishQueueJobs() {
    this.logger.log('[DIAGNOSTIC] Fetching publish queue jobs...');

    try {
      const waiting = await this.publishQueue.getWaiting(0, 10);
      const active = await this.publishQueue.getActive(0, 10);
      const completed = await this.publishQueue.getCompleted(0, 10);
      const failed = await this.publishQueue.getFailed(0, 10);

      const result = {
        timestamp: new Date().toISOString(),
        waiting: waiting.map(job => ({
          id: job.id,
          data: job.data,
          timestamp: job.timestamp,
          attemptsMade: job.attemptsMade,
        })),
        active: active.map(job => ({
          id: job.id,
          data: job.data,
          timestamp: job.timestamp,
          attemptsMade: job.attemptsMade,
        })),
        completed: completed.map(job => ({
          id: job.id,
          data: job.data,
          timestamp: job.timestamp,
          finishedOn: job.finishedOn,
        })),
        failed: failed.map(job => ({
          id: job.id,
          data: job.data,
          timestamp: job.timestamp,
          failedReason: job.failedReason,
          attemptsMade: job.attemptsMade,
        })),
      };

      this.logger.log(`[DIAGNOSTIC] Found ${waiting.length} waiting, ${active.length} active, ${completed.length} completed, ${failed.length} failed jobs`);
      return result;
    } catch (error) {
      this.logger.error(`[DIAGNOSTIC] ❌ Failed to get publish queue jobs: ${error.message}`, error.stack);
      throw error;
    }
  }
}
