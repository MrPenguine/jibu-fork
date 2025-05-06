import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

@Processor('default')
export class QueueProcessor {
  private readonly logger = new Logger(QueueProcessor.name);

  @Process('default-job')
  async processDefaultJob(job: Job) {
    this.logger.debug(`Processing job ${job.id} of type default-job`);
    this.logger.debug(`Job data: ${JSON.stringify(job.data)}`);
    
    try {
      // Process your job here
      // This is where you would put your actual job processing logic
      
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.logger.log(`Job ${job.id} completed successfully`);
      return { success: true, processedAt: new Date() };
    } catch (error) {
      this.logger.error(`Error processing job ${job.id}`, error.stack);
      throw error;
    }
  }

  // Example of another job processor
  @Process('email-job')
  async processEmailJob(job: Job<{ recipient: string; subject: string; body: string }>) {
    this.logger.debug(`Processing job ${job.id} of type email-job`);
    
    try {
      // Simulate sending an email
      this.logger.log(`Sending email to: ${job.data.recipient}`);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return { sent: true, to: job.data.recipient };
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`);
      throw error;
    }
  }
} 