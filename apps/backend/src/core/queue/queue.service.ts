import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, JobOptions, JobStatusClean } from 'bull';

import { 
  QUEUE_NAMES, 
  JOB_NAMES,
  IndexFileSourceJobData,
  DeindexSourceJobData,
  EmailJobData,
  WebhookPayload,
} from '@jibu/queue-definitions';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.DEFAULT) private readonly defaultQueue: Queue,
    @InjectQueue(QUEUE_NAMES.INDEXING) private readonly indexingQueue: Queue,
    @InjectQueue(QUEUE_NAMES.WORKFLOW_PUBLISH) private readonly publishQueue: Queue,
    @InjectQueue(QUEUE_NAMES.WEBHOOK_DELIVERY) private readonly webhookQueue: Queue,
  ) {}

  /**
   * Add a generic job to the default queue
   */
  async addJob(jobName: string, data: any, options?: JobOptions) {
    try {
      const job = await this.defaultQueue.add(jobName, data, options);
      this.logger.debug(`Added generic job: ${jobName}`);
      return job;
    } catch (error) {
      this.logger.error(`Failed to add job ${jobName}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Add a job to the email queue
   */
  async addEmailJob(data: EmailJobData, options?: JobOptions) {
    try {
      const job = await this.defaultQueue.add(JOB_NAMES.EMAIL_JOB, data, options);
      this.logger.debug(`Added email job for recipient: ${data.recipient}`);
      return job;
    } catch (error) {
      this.logger.error(`Failed to add email job: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Add a job to index a knowledge base source
   */
  async addIndexKnowledgeBaseSourceJob(
    data: IndexFileSourceJobData,
    options?: any,
  ): Promise<void> {
    try {
      await this.indexingQueue.add(JOB_NAMES.INDEX_FILE_SOURCE, data, options);
      this.logger.debug(
        `Added indexing job for source: ${data.knowledgeBaseSourceId} in workspace: ${data.workspaceId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to add indexing job: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Add a job to de-index a knowledge base source
   */
  async addDeindexSourceJob(
    data: DeindexSourceJobData,
    options?: any,
  ): Promise<void> {
    try {
      await this.indexingQueue.add(JOB_NAMES.DEINDEX_SOURCE, data, options);
      this.logger.debug(
        `Added de-indexing job for source: ${data.knowledgeBaseSourceId}, type: ${data.sourceType}`,
      );
    } catch (error) {
      this.logger.error(`Failed to add de-indexing job: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get a job by ID
   * @param jobId The ID of the job to get
   */
  async getJob(jobId: string) {
    return this.defaultQueue.getJob(jobId);
  }

  /**
   * Add a publish workflow job to the publish queue
   */
  async addPublishWorkflowJob(data: any, options?: JobOptions) {
    try {
      this.logger.log(`[DIAGNOSTIC] Attempting to enqueue publish job for workflow: ${data.workflowId}`);
      this.logger.debug(`[DIAGNOSTIC] Job data: ${JSON.stringify(data)}`);
      this.logger.debug(`[DIAGNOSTIC] Job options: ${JSON.stringify(options || {})}`);
      
      // Check queue health
      const queueHealth = await this.publishQueue.isReady();
      this.logger.log(`[DIAGNOSTIC] Publish queue ready status: ${queueHealth}`);
      
      const job = await this.publishQueue.add(JOB_NAMES.PUBLISH_WORKFLOW, data, options);
      
      this.logger.log(`[DIAGNOSTIC] Successfully added publish job. Job ID: ${job.id}, Workflow: ${data.workflowId}`);
      this.logger.debug(`[DIAGNOSTIC] Job details: ${JSON.stringify({ id: job.id, name: job.name, timestamp: job.timestamp })}`);
      
      return job;
    } catch (error) {
      this.logger.error(`[DIAGNOSTIC] Failed to add publish job for workflow ${data?.workflowId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get a publish job by ID
   */
  async getPublishJob(jobId: string) {
    return this.publishQueue.getJob(jobId);
  }

  /**
   * Get the current state of the queue
   */
  async getQueueState() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.defaultQueue.getWaitingCount(),
      this.defaultQueue.getActiveCount(),
      this.defaultQueue.getCompletedCount(),
      this.defaultQueue.getFailedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
    };
  }

  /**
   * Clean the queue
   * @param grace Grace period in milliseconds
   * @param limit Maximum number of jobs to clean
   * @param status Job status to clean (completed, wait, active, delayed, or failed)
   */
  async cleanQueue(grace = 5000, limit = 1000, status?: JobStatusClean) {
    return this.defaultQueue.clean(grace, status, limit);
  }

  /**
   * Get webhook delivery queue statistics
   */
  async getWebhookQueueState() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.webhookQueue.getWaitingCount(),
      this.webhookQueue.getActiveCount(),
      this.webhookQueue.getCompletedCount(),
      this.webhookQueue.getFailedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
    };
  }

  /**
   * Add a webhook delivery job to the WEBHOOK_DELIVERY queue
   */
  async addWebhookDeliveryJob(payload: WebhookPayload, options?: JobOptions) {
    try {
      const job = await this.webhookQueue.add(JOB_NAMES.DELIVER_WEBHOOK, payload, options);
      this.logger.debug(
        `Added webhook delivery job for workflow: ${(payload as any).workflowId}, session: ${(payload as any).sessionId}`,
      );
      return job;
    } catch (error) {
      this.logger.error(
        `Failed to add webhook delivery job: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  /**
   * Get a webhook delivery job by ID
   */
  async getWebhookJob(jobId: string) {
    return this.webhookQueue.getJob(jobId);
  }
}