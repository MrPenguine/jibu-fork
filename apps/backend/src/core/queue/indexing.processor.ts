import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

@Processor('indexing')
export class IndexingProcessor {
  private readonly logger = new Logger(IndexingProcessor.name);

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
    this.logger.debug(`Processing job ${job.id} of type deindex-source`);
    
    try {
      // In a future sprint, this would be where we implement the actual de-indexing logic
      // For now, we'll just simulate some work
      
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.logger.log(`De-indexing job ${job.id} completed for source ${job.data.knowledgeBaseSourceId}`);
      return { success: true, deindexedAt: new Date() };
    } catch (error) {
      this.logger.error(`Failed to de-index source: ${error.message}`);
      throw error;
    }
  }
} 