import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { QUEUE_NAMES, JOB_NAMES, DefaultJobData, EmailJobData } from '@jibu/queue-definitions';

@Processor(QUEUE_NAMES.DEFAULT)
export class QueueProcessor {
  private readonly logger = new Logger(QueueProcessor.name);

  @Process(JOB_NAMES.DEFAULT_JOB)
  async processDefaultJob(job: Job<DefaultJobData>) {
    this.logger.debug(`Processing job ${job.id} of type ${job.name} with data: ${JSON.stringify(job.data)}`);
    
    try {
      // Simulate work with a delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.logger.debug(`Job ${job.id} completed successfully`);
      return { success: true, jobId: job.id };
    } catch (error) {
      this.logger.error(`Error processing job ${job.id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Process(JOB_NAMES.EMAIL_JOB)
  async processEmailJob(job: Job<EmailJobData>) {
    this.logger.debug(`Processing email job ${job.id} for recipient: ${job.data.recipient}`);
    
    try {
      // Simulate sending an email
      await new Promise(resolve => setTimeout(resolve, 500));
      
      this.logger.debug(`Email job ${job.id} completed successfully. Email sent to ${job.data.recipient}`);
      return { success: true, jobId: job.id, recipient: job.data.recipient };
    } catch (error) {
      this.logger.error(`Error processing email job ${job.id}: ${error.message}`, error.stack);
      throw error;
    }
  }
} 