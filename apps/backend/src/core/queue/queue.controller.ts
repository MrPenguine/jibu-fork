import { Controller, Get, Post, Body, Param, Delete, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { QueueService } from './queue.service';
import { JOB_NAMES } from '@jibu/queue-definitions';

interface ReindexSourceDto {
  knowledgeBaseId: string;
  sourceId: string;
  organizationId: string;
}

@Controller('v1/queue')
export class QueueController {
  private readonly logger = new Logger(QueueController.name);

  constructor(private readonly queueService: QueueService) {}

  @Post('job')
  async addJob(@Body() jobData: any) {
    const job = await this.queueService.addJob(JOB_NAMES.DEFAULT_JOB, jobData);
    return {
      jobId: job.id,
      message: 'Job added to queue successfully',
    };
  }

  @Post('email')
  async sendEmail(@Body() emailData: { recipient: string; subject: string; body: string }) {
    const job = await this.queueService.addEmailJob(emailData);
    return {
      jobId: job.id,
      message: 'Email job added to queue',
    };
  }

  @Get('status')
  async getQueueStatus() {
    return this.queueService.getQueueState();
  }

  @Get('job/:id')
  async getJob(@Param('id') id: string) {
    const job = await this.queueService.getJob(id);
    if (!job) {
      return { message: 'Job not found' };
    }
    return {
      id: job.id,
      data: job.data,
      state: await job.getState(),
      progress: job.progress(),
    };
  }

  @Delete('clean')
  async cleanQueue() {
    await this.queueService.cleanQueue();
    return { message: 'Queue cleaned successfully' };
  }

  @Post('reindex-source')
  async reindexSource(@Body() reindexDto: ReindexSourceDto) {
    try {
      this.logger.log(`Received request to reindex source ${reindexDto.sourceId} for knowledge base ${reindexDto.knowledgeBaseId}`);
      
      if (!reindexDto.sourceId || !reindexDto.knowledgeBaseId || !reindexDto.organizationId) {
        throw new HttpException('Missing required fields', HttpStatus.BAD_REQUEST);
      }
      
      // Add job to the indexing queue
      await this.queueService.addIndexKnowledgeBaseSourceJob({
        knowledgeBaseSourceId: reindexDto.sourceId,
        organizationId: reindexDto.organizationId,
      });
      
      this.logger.log(`Successfully queued reindexing job for source ${reindexDto.sourceId}`);
      
      return { 
        success: true, 
        message: 'Source queued for reindexing',
        sourceId: reindexDto.sourceId,
      };
    } catch (error) {
      this.logger.error(`Error queueing reindexing job: ${error.message}`, error.stack);
      throw new HttpException(
        `Failed to queue reindexing job: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
} 