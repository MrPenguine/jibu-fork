import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue, JobOptions } from 'bull';
import { QUEUE_NAMES } from '@jibu/queue-definitions';

/**
 * Dead letter queue service for handling failed jobs
 */
@Injectable()
export class DeadLetterService {
  private readonly logger = new Logger(DeadLetterService.name);
  private readonly deadLetterQueueName = 'dead-letter-queue';
  private readonly maxRetries: number;

  constructor(
    private readonly configService: ConfigService,
    @InjectQueue(QUEUE_NAMES.WORKFLOW_EXECUTION) private workflowQueue: Queue,
  ) {
    this.maxRetries = parseInt(
      this.configService.get('MAX_JOB_RETRIES', '3'),
      10,
    );
    this.logger.log(`Dead letter service initialized with maxRetries=${this.maxRetries}`);
  }

  /**
   * Process a failed job and move it to the dead letter queue if needed
   * @param queueName The original queue name
   * @param jobId The job ID
   * @param error The error that caused the job to fail
   * @param jobData The job data
   */
  async processFailedJob(
    queueName: string,
    jobId: string,
    error: Error,
    jobData: any,
  ): Promise<void> {
    try {
      // Get the job from the queue
      const job = await this.workflowQueue.getJob(jobId);
      
      if (!job) {
        this.logger.warn(`Job ${jobId} not found in queue ${queueName}`);
        return;
      }

      // Check if the job has exceeded max retries
      if (job.attemptsMade >= this.maxRetries) {
        this.logger.warn(
          `Job ${jobId} in queue ${queueName} has failed ${job.attemptsMade} times, moving to dead letter queue`,
        );

        // Add to dead letter queue with original data and error information
        await this.addToDeadLetterQueue(queueName, jobId, error, jobData);
        
        // Remove from original queue to prevent further processing
        await job.remove();
        
        this.logger.log(`Job ${jobId} moved to dead letter queue and removed from ${queueName}`);
      } else {
        this.logger.log(
          `Job ${jobId} in queue ${queueName} has failed ${job.attemptsMade} times, will be retried`,
        );
      }
    } catch (dlqError) {
      this.logger.error(
        `Error processing failed job ${jobId}: ${dlqError.message}`,
        dlqError.stack,
      );
    }
  }

  /**
   * Add a job to the dead letter queue
   * @param originalQueue The original queue name
   * @param originalJobId The original job ID
   * @param error The error that caused the job to fail
   * @param jobData The original job data
   */
  private async addToDeadLetterQueue(
    originalQueue: string,
    originalJobId: string,
    error: Error,
    jobData: any,
  ): Promise<void> {
    const deadLetterData = {
      originalQueue,
      originalJobId,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      jobData,
      failedAt: new Date().toISOString(),
    };

    const jobOptions: JobOptions = {
      attempts: 1, // No retries for dead letter queue
      removeOnComplete: false, // Keep the job for analysis
      removeOnFail: false,
    };

    // Store in a persistent store (could be a database, file, etc.)
    this.logDeadLetterJob(deadLetterData);
  }

  /**
   * Log dead letter job to a persistent store
   * This is a placeholder implementation that logs to console
   * In a real implementation, this would store the job in a database
   */
  private logDeadLetterJob(deadLetterData: any): void {
    this.logger.error(
      `DEAD LETTER JOB: ${JSON.stringify(deadLetterData, null, 2)}`,
    );
    
    // In a real implementation, you would store this in a database
    // For example:
    // await this.prismaService.deadLetterJob.create({
    //   data: {
    //     originalQueue: deadLetterData.originalQueue,
    //     originalJobId: deadLetterData.originalJobId,
    //     errorMessage: deadLetterData.error.message,
    //     errorStack: deadLetterData.error.stack,
    //     jobData: deadLetterData.jobData,
    //     failedAt: new Date(deadLetterData.failedAt),
    //   },
    // });
  }

  /**
   * Retry a job from the dead letter queue
   * @param deadLetterJobId The dead letter job ID to retry
   */
  async retryDeadLetterJob(deadLetterJobId: string): Promise<boolean> {
    try {
      // In a real implementation, you would retrieve the job from the database
      // For this example, we'll just log that we would retry it
      this.logger.log(`Would retry dead letter job ${deadLetterJobId}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Error retrying dead letter job ${deadLetterJobId}: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }
}
