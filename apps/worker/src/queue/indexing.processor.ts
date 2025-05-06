import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { 
  QUEUE_NAMES, 
  JOB_NAMES, 
  IndexFileSourceJobData, 
  DeindexSourceJobData 
} from '@jibu/queue-definitions';

@Processor(QUEUE_NAMES.INDEXING)
export class IndexingProcessor {
  private readonly logger = new Logger(IndexingProcessor.name);

  @Process(JOB_NAMES.INDEX_FILE_SOURCE)
  async processIndexFileSource(job: Job<IndexFileSourceJobData>) {
    this.logger.debug(
      `Processing index job ${job.id} for source: ${job.data.knowledgeBaseSourceId} in org: ${job.data.organizationId}`
    );
    
    try {
      // Simulate indexing work with a delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      this.logger.debug(`Indexing job ${job.id} completed successfully`);
      return { 
        success: true, 
        jobId: job.id, 
        knowledgeBaseSourceId: job.data.knowledgeBaseSourceId 
      };
    } catch (error) {
      this.logger.error(`Error processing indexing job ${job.id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Process(JOB_NAMES.DEINDEX_SOURCE)
  async processDeindexSource(job: Job<DeindexSourceJobData>) {
    this.logger.debug(
      `Processing deindex job ${job.id} for source: ${job.data.knowledgeBaseSourceId}, type: ${job.data.sourceType}`
    );
    
    try {
      // Simulate deindexing work with a delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.logger.debug(`Deindexing job ${job.id} completed successfully`);
      return { 
        success: true, 
        jobId: job.id, 
        knowledgeBaseSourceId: job.data.knowledgeBaseSourceId,
        sourceType: job.data.sourceType
      };
    } catch (error) {
      this.logger.error(`Error processing deindex job ${job.id}: ${error.message}`, error.stack);
      throw error;
    }
  }
} 