import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, JobOptions } from 'bull';
import { QUEUE_NAMES, JOB_NAMES, WebhookDeliveryJobData } from '@jibu/queue-definitions';
import { WebhookCacheService } from '@jibu/cache-utils';
import { ConnectionService } from './connection.service';

/**
 * Priority levels for webhook delivery jobs
 */
export enum WebhookPriority {
  VOICE_HIGH = 10, // Voice events (highest priority)
  VOICE_NORMAL = 5, // Voice events (normal priority)
  NON_VOICE = 1, // Non-voice workflows
}

/**
 * Service for enqueuing webhook delivery jobs
 * Implements voice-specific optimizations and priority handling
 */
@Injectable()
export class MessageQueueService {
  private readonly logger = new Logger(MessageQueueService.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.WEBHOOK_DELIVERY) private readonly webhookQueue: Queue,
    private readonly cacheService: WebhookCacheService,
    private readonly connectionService: ConnectionService,
  ) {}

  /**
   * Send a message to a workflow via webhook
   * This is the primary method for non-voice workflows
   * @param workflowId - The workflow ID
   * @param sessionId - The session ID
   * @param payload - The message payload
   * @param options - Optional job options
   */
  async sendMessageToWorkflow(
    workflowId: string,
    sessionId: string,
    payload: any,
    options?: JobOptions
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Validate that webhook URL exists in cache
      const webhookUrl = await this.cacheService.getWebhookUrl(workflowId, false);
      
      if (!webhookUrl) {
        this.logger.warn(
          `Webhook URL not in cache for workflow ${workflowId}, will be fetched by worker`
        );
      }

      // Check circuit breaker
      if (this.cacheService.shouldTriggerCircuitBreaker(workflowId)) {
        this.logger.error(
          `Circuit breaker triggered for workflow ${workflowId}, rejecting message`
        );
        throw new Error(`Circuit breaker open for workflow ${workflowId}`);
      }

      // Prepare job data
      const jobData: WebhookDeliveryJobData = {
        workflowId,
        sessionId,
        payload,
        isVoice: false,
        priority: WebhookPriority.NON_VOICE,
      };

      // Enqueue with low priority
      const job = await this.webhookQueue.add(JOB_NAMES.DELIVER_WEBHOOK, jobData, {
        priority: WebhookPriority.NON_VOICE,
        ...options,
      });

      const duration = Date.now() - startTime;
      this.logger.log(
        `Message enqueued for workflow ${workflowId}, session ${sessionId}, job ${job.id} in ${duration}ms`
      );

      // Log warning if enqueuing took too long
      if (duration > 100) {
        this.logger.warn(
          `Message enqueuing exceeded target latency: ${duration}ms (target < 100ms)`
        );
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to enqueue message for workflow ${workflowId}: ${err.message}`,
        err.stack
      );
      throw error;
    }
  }

  /**
   * Send a call event to a voice workflow via webhook
   * This method has higher priority and stricter latency requirements
   * @param workflowId - The workflow ID
   * @param sessionId - The session ID
   * @param payload - The call event payload
   * @param connectionId - Optional connection ID for tracking
   * @param highPriority - Whether this is a high-priority event (default true)
   * @param options - Optional job options
   */
  async sendCallEventToWorkflow(
    workflowId: string,
    sessionId: string,
    payload: any,
    connectionId?: string,
    highPriority: boolean = true,
    options?: JobOptions
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Validate connection context if provided
      if (connectionId) {
        const connection = await this.connectionService.getConnection(connectionId);
        
        if (!connection) {
          this.logger.warn(
            `Connection ${connectionId} not found, proceeding without validation`
          );
        } else if (!connection.isActive) {
          this.logger.warn(
            `Connection ${connectionId} is not active, event may be rejected`
          );
        }
      }

      // Pre-warm cache for voice workflow
      const webhookUrl = await this.cacheService.getWebhookUrl(workflowId, true);
      
      if (!webhookUrl) {
        this.logger.warn(
          `Webhook URL not in cache for voice workflow ${workflowId}, will be fetched by worker`
        );
      }

      // Check circuit breaker
      if (this.cacheService.shouldTriggerCircuitBreaker(workflowId)) {
        this.logger.error(
          `Circuit breaker triggered for voice workflow ${workflowId}, rejecting event`
        );
        throw new Error(`Circuit breaker open for workflow ${workflowId}`);
      }

      // Prepare job data with high priority
      const priority = highPriority ? WebhookPriority.VOICE_HIGH : WebhookPriority.VOICE_NORMAL;
      const jobData: WebhookDeliveryJobData = {
        workflowId,
        sessionId,
        payload,
        isVoice: true,
        connectionId,
        priority,
      };

      // Enqueue with high priority
      const job = await this.webhookQueue.add(JOB_NAMES.DELIVER_WEBHOOK, jobData, {
        priority,
        attempts: 2, // Only 2 attempts for voice
        timeout: 5000, // 5-second timeout
        ...options,
      });

      const duration = Date.now() - startTime;
      this.logger.log(
        `Voice event enqueued for workflow ${workflowId}, session ${sessionId}, job ${job.id} in ${duration}ms`
      );

      // Log warning if enqueuing exceeded voice threshold
      if (duration > 50) {
        this.logger.warn(
          `Voice event enqueuing exceeded target latency: ${duration}ms (target < 50ms)`
        );
      }

      // Update connection heartbeat if provided
      if (connectionId) {
        await this.connectionService.updateHeartbeat(connectionId);
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to enqueue voice event for workflow ${workflowId}: ${err.message}`,
        err.stack
      );
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.webhookQueue.getWaitingCount(),
      this.webhookQueue.getActiveCount(),
      this.webhookQueue.getCompletedCount(),
      this.webhookQueue.getFailedCount(),
      this.webhookQueue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + delayed,
    };
  }

  /**
   * Get queue health status
   */
  async getQueueHealth(): Promise<{ healthy: boolean; reason?: string }> {
    try {
      const stats = await this.getQueueStats();

      // Queue is unhealthy if too many jobs are waiting
      if (stats.waiting > 100) {
        return {
          healthy: false,
          reason: `Too many waiting jobs: ${stats.waiting}`,
        };
      }

      // Queue is unhealthy if too many jobs have failed
      if (stats.failed > 50) {
        return {
          healthy: false,
          reason: `Too many failed jobs: ${stats.failed}`,
        };
      }

      return { healthy: true };
    } catch (error) {
      const err = error as Error;
      return {
        healthy: false,
        reason: `Queue health check failed: ${err.message}`,
      };
    }
  }

  /**
   * Pause the queue (for maintenance)
   */
  async pauseQueue(): Promise<void> {
    await this.webhookQueue.pause();
    this.logger.warn('Webhook delivery queue paused');
  }

  /**
   * Resume the queue
   */
  async resumeQueue(): Promise<void> {
    await this.webhookQueue.resume();
    this.logger.log('Webhook delivery queue resumed');
  }

  /**
   * Clean completed jobs from the queue
   */
  async cleanCompletedJobs(olderThanMs: number = 60000): Promise<void> {
    await this.webhookQueue.clean(olderThanMs, 'completed');
    this.logger.log(`Cleaned completed jobs older than ${olderThanMs}ms`);
  }

  /**
   * Clean failed jobs from the queue
   */
  async cleanFailedJobs(olderThanMs: number = 3600000): Promise<void> {
    await this.webhookQueue.clean(olderThanMs, 'failed');
    this.logger.log(`Cleaned failed jobs older than ${olderThanMs}ms`);
  }
}
