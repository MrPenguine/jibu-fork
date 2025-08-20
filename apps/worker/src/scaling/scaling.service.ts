import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { QUEUE_NAMES } from '@jibu/queue-definitions';
import { N8nWorkerConfig } from '../n8n/n8n-worker.config';

@Injectable()
export class ScalingService implements OnModuleInit {
  private readonly logger = new Logger(ScalingService.name);
  private currentWorkers: number;
  private readonly minWorkers: number;
  private readonly maxWorkers: number;
  private readonly queueThreshold: number;
  private readonly scalingEnabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly n8nWorkerConfig: N8nWorkerConfig,
    @InjectQueue(QUEUE_NAMES.WORKFLOW_EXECUTION) private workflowQueue: Queue,
  ) {
    this.minWorkers = this.n8nWorkerConfig.getMinWorkers();
    this.maxWorkers = this.n8nWorkerConfig.getMaxWorkers();
    this.queueThreshold = this.n8nWorkerConfig.getQueueThreshold();
    this.currentWorkers = this.minWorkers;
    this.scalingEnabled = this.configService.get('ENABLE_WORKER_SCALING', 'false') === 'true';
    
    this.logger.log(`Scaling service initialized with min=${this.minWorkers}, max=${this.maxWorkers}, threshold=${this.queueThreshold}`);
    this.logger.log(`Worker scaling is ${this.scalingEnabled ? 'enabled' : 'disabled'}`);
  }

  onModuleInit() {
    // Initialize with minimum workers
    this.currentWorkers = this.minWorkers;
    this.logger.log(`Starting with ${this.currentWorkers} workers`);
  }

  /**
   * Monitor queue length and scale workers accordingly
   * Runs every 30 seconds
   */
  @Interval(30000)
  async monitorQueue() {
    if (!this.scalingEnabled) {
      return;
    }

    try {
      // Get queue metrics
      const queueLength = await this.getQueueLength();
      const activeJobs = await this.getActiveJobCount();
      const waitingJobs = await this.getWaitingJobCount();
      
      this.logger.debug(`Queue metrics: length=${queueLength}, active=${activeJobs}, waiting=${waitingJobs}, workers=${this.currentWorkers}`);
      
      // Determine if we need to scale
      if (waitingJobs > this.queueThreshold && this.currentWorkers < this.maxWorkers) {
        await this.scaleUp();
      } else if (waitingJobs < this.queueThreshold / 2 && activeJobs < this.currentWorkers / 2 && this.currentWorkers > this.minWorkers) {
        await this.scaleDown();
      }
    } catch (error) {
      this.logger.error(`Error monitoring queue: ${error.message}`, error.stack);
    }
  }

  /**
   * Get the total number of jobs in the queue
   */
  private async getQueueLength(): Promise<number> {
    const counts = await this.workflowQueue.getJobCounts();
    return counts.waiting + counts.active + counts.delayed;
  }

  /**
   * Get the number of active jobs
   */
  private async getActiveJobCount(): Promise<number> {
    const counts = await this.workflowQueue.getJobCounts();
    return counts.active;
  }

  /**
   * Get the number of waiting jobs
   */
  private async getWaitingJobCount(): Promise<number> {
    const counts = await this.workflowQueue.getJobCounts();
    return counts.waiting;
  }

  /**
   * Scale up the number of workers
   */
  private async scaleUp(): Promise<void> {
    const previousWorkers = this.currentWorkers;
    
    // Increase by 50% rounded up, but not exceeding max
    const newWorkers = Math.min(
      Math.ceil(this.currentWorkers * 1.5),
      this.maxWorkers
    );
    
    if (newWorkers > previousWorkers) {
      this.currentWorkers = newWorkers;
      this.logger.log(`Scaling up workers from ${previousWorkers} to ${this.currentWorkers}`);
      
      // Here you would implement the actual scaling logic
      // This could be calling a Kubernetes API, Docker API, etc.
      await this.applyScaling();
    }
  }

  /**
   * Scale down the number of workers
   */
  private async scaleDown(): Promise<void> {
    const previousWorkers = this.currentWorkers;
    
    // Decrease by 25% rounded down, but not below min
    const newWorkers = Math.max(
      Math.floor(this.currentWorkers * 0.75),
      this.minWorkers
    );
    
    if (newWorkers < previousWorkers) {
      this.currentWorkers = newWorkers;
      this.logger.log(`Scaling down workers from ${previousWorkers} to ${this.currentWorkers}`);
      
      // Here you would implement the actual scaling logic
      await this.applyScaling();
    }
  }

  /**
   * Apply the scaling changes to the infrastructure
   * This is a placeholder for the actual implementation
   */
  private async applyScaling(): Promise<void> {
    // In a real implementation, this would call the infrastructure API
    // to scale the number of worker pods/containers
    
    this.logger.log(`Applied scaling: ${this.currentWorkers} workers`);
    
    // For demonstration purposes, we'll just log the scaling action
    // In a real implementation, you might:
    // 1. Call Kubernetes API to scale a deployment
    // 2. Call Docker API to scale a service
    // 3. Call a cloud provider API to scale a service
    // 4. Use a custom scaling mechanism
  }
}
