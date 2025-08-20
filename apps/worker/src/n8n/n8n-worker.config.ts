import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class N8nWorkerConfig {
  private readonly logger = new Logger(N8nWorkerConfig.name);

  constructor(private readonly configService: ConfigService) {
    this.logger.log('Initializing N8n Worker Configuration');
  }

  /**
   * Get the Redis configuration for the worker
   */
  getRedisConfig() {
    return {
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: parseInt(this.configService.get('REDIS_PORT', '6379'), 10),
      password: this.configService.get('REDIS_PASSWORD'),
    };
  }

  /**
   * Get the Bull queue configuration for workflow execution
   */
  getQueueConfig() {
    return {
      prefix: 'bull',
      defaultJobOptions: {
        attempts: this.getWorkerRetryAttempts(),
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
      limiter: {
        max: this.getWorkerConcurrency(),
        duration: 1000,
      },
    };
  }

  /**
   * Get the n8n API configuration
   */
  getN8nApiConfig() {
    return {
      url: this.configService.get('N8N_API_URL'),
      key: this.configService.get('N8N_API_KEY'),
    };
  }

  /**
   * Get the worker concurrency (max number of jobs to process simultaneously)
   */
  getWorkerConcurrency(): number {
    return parseInt(this.configService.get('N8N_WORKER_CONCURRENCY', '5'), 10);
  }

  /**
   * Get the worker timeout in milliseconds
   */
  getWorkerTimeout(): number {
    return parseInt(this.configService.get('N8N_WORKER_TIMEOUT', '300000'), 10); // Default: 5 minutes
  }

  /**
   * Get the number of retry attempts for failed jobs
   */
  getWorkerRetryAttempts(): number {
    return parseInt(this.configService.get('N8N_WORKER_RETRY_ATTEMPTS', '3'), 10);
  }

  /**
   * Get the worker memory limit in MB
   */
  getWorkerMemoryLimit(): number {
    return parseInt(this.configService.get('N8N_WORKER_MEMORY_LIMIT', '512'), 10);
  }

  /**
   * Get the minimum number of workers to maintain
   */
  getMinWorkers(): number {
    return parseInt(this.configService.get('N8N_MIN_WORKERS', '1'), 10);
  }

  /**
   * Get the maximum number of workers to scale to
   */
  getMaxWorkers(): number {
    return parseInt(this.configService.get('N8N_MAX_WORKERS', '10'), 10);
  }

  /**
   * Get the queue threshold for scaling up workers
   */
  getQueueThreshold(): number {
    return parseInt(this.configService.get('N8N_QUEUE_THRESHOLD', '100'), 10);
  }

  /**
   * Get the complete worker configuration
   */
  getWorkerConfig() {
    return {
      redis: this.getRedisConfig(),
      queue: this.getQueueConfig(),
      n8n: this.getN8nApiConfig(),
      worker: {
        concurrency: this.getWorkerConcurrency(),
        timeout: this.getWorkerTimeout(),
        retryAttempts: this.getWorkerRetryAttempts(),
        memoryLimit: this.getWorkerMemoryLimit(),
        minWorkers: this.getMinWorkers(),
        maxWorkers: this.getMaxWorkers(),
        queueThreshold: this.getQueueThreshold(),
      },
    };
  }
}
