import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { QUEUE_NAMES, JOB_NAMES } from '@jibu/queue-definitions';

@Processor('indexing')
export class IndexingProcessor {
  private readonly logger = new Logger(IndexingProcessor.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.INDEXING) private readonly indexingQueue: Queue,
  ) {}

  @Process('index-file-source')
  async processIndexFileSource(job: Job<{ knowledgeBaseSourceId: string; organizationId: string }>) {
    this.logger.debug(`Processing job ${job.id} of type index-file-source`);
    this.logger.debug(`Job data: ${JSON.stringify(job.data)}`);
    
    try {
      // In a future sprint, this would be where we implement the actual indexing logic
      // For now, we'll just simulate some work and update the status in the database
      
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      this.logger.log(`Indexing job ${job.id} completed for source ${job.data.knowledgeBaseSourceId}`);
      return { success: true, processedAt: new Date() };
    } catch (error) {
      this.logger.error(`Error processing indexing job ${job.id}`, error.stack);
      throw error;
    }
  }

  @Process('deindex-source')
  async processDeindexSource(
    job: Job<{
      knowledgeBaseSourceId: string;
      organizationId: string;
      sourceType: string;
      sourcePointer: string;
    }>,
  ) {
    this.logger.debug(`Forwarding deindex job ${job.id} to worker`);
    
    try {
      // Forward the job to the worker by adding it to the same queue
      // The worker will pick it up and process it
      await this.indexingQueue.add(JOB_NAMES.DEINDEX_SOURCE, job.data, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
      });
      
      this.logger.log(`Deindex job ${job.id} forwarded to worker for source ${job.data.knowledgeBaseSourceId}`);
      return { success: true, forwardedAt: new Date() };
    } catch (error) {
      this.logger.error(`Failed to forward deindex job to worker: ${error.message}`);
      throw error;
    }
  }
} 