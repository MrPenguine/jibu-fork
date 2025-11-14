import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Job } from 'bull';
import { ConfigService } from '@nestjs/config';
import { QUEUE_NAMES, JOB_NAMES, WebhookDeliveryJobData } from '@jibu/queue-definitions';
import { WebhookCacheService } from '@jibu/cache-utils';
import axios, { AxiosError } from 'axios';

/**
 * Processor for webhook delivery jobs
 * Handles delivery of messages and events to n8n webhooks
 * Optimized for voice workflows with strict latency requirements
 */
@Injectable()
@Processor(QUEUE_NAMES.WEBHOOK_DELIVERY)
export class WebhookDeliveryProcessor implements OnModuleInit {
  private readonly logger = new Logger(WebhookDeliveryProcessor.name);
  private readonly WEBHOOK_TIMEOUT_MS = 5000; // 5-second timeout for voice
  private readonly FALLBACK_MESSAGE = 'I apologize, but I\'m experiencing technical difficulties. Please try again.';

  // Circuit breaker tracking
  private readonly failureCount = new Map<string, number>();
  private readonly circuitBreakerThreshold = 3;
  private readonly circuitBreakerResetTime = 5 * 60 * 1000; // 5 minutes

  // Metrics
  private deliveryCount = 0;
  private failureCountTotal = 0;
  private fallbackCount = 0;
  private totalDeliveryTime = 0;

  constructor(
    private readonly cacheService: WebhookCacheService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    this.logger.log(`WebhookDeliveryProcessor initialized for queue: ${QUEUE_NAMES.WEBHOOK_DELIVERY}`);
    this.logger.log(`Listening for job: ${JOB_NAMES.DELIVER_WEBHOOK}`);
    
    // Log metrics every 5 minutes
    setInterval(() => {
      this.logMetrics();
    }, 5 * 60 * 1000);
  }

  @OnQueueActive()
  onActive(job: Job<WebhookDeliveryJobData>) {
    const { workflowId, sessionId, isVoice } = job.data;
    this.logger.debug(
      `Job ${job.id} active - Delivering ${isVoice ? 'voice' : 'non-voice'} webhook for workflow ${workflowId}, session ${sessionId}`
    );
  }

  @OnQueueCompleted()
  onCompleted(job: Job<WebhookDeliveryJobData>, result: any) {
    const { workflowId, isVoice } = job.data;
    this.logger.log(
      `Job ${job.id} completed - ${isVoice ? 'Voice' : 'Non-voice'} webhook delivered for workflow ${workflowId}`
    );
  }

  @OnQueueFailed()
  onFailed(job: Job<WebhookDeliveryJobData>, err: Error) {
    const { workflowId, sessionId, isVoice } = job.data;
    this.logger.error(
      `Job ${job.id} failed - ${isVoice ? 'Voice' : 'Non-voice'} webhook delivery failed for workflow ${workflowId}, session ${sessionId}: ${err.message}`,
      err.stack
    );
    this.failureCountTotal++;
  }

  @Process(JOB_NAMES.DELIVER_WEBHOOK)
  async handle(job: Job<WebhookDeliveryJobData>) {
    const startTime = Date.now();
    const { workflowId, sessionId, payload, isVoice, connectionId, priority } = job.data;

    try {
      this.logger.log(
        `Processing webhook delivery job ${job.id} for workflow ${workflowId}, session ${sessionId}, isVoice: ${isVoice}, priority: ${priority}`
      );

      // Step 1: Check circuit breaker
      if (this.shouldTriggerCircuitBreaker(workflowId)) {
        this.logger.error(
          `Circuit breaker open for workflow ${workflowId}, triggering fallback`
        );
        
        if (isVoice) {
          this.fallbackCount++;
          return { fallback: true, message: this.FALLBACK_MESSAGE };
        }
        
        throw new Error(`Circuit breaker open for workflow ${workflowId}`);
      }

      // Step 2: Retrieve webhook URL from cache
      const webhookUrl = await this.getWebhookUrl(workflowId, isVoice);
      
      if (!webhookUrl) {
        this.logger.error(`No webhook URL found for workflow ${workflowId}`);
        
        if (isVoice) {
          this.fallbackCount++;
          return { fallback: true, message: this.FALLBACK_MESSAGE };
        }
        
        throw new Error(`No webhook URL found for workflow ${workflowId}`);
      }

      // Step 3: Deliver payload to webhook
      const deliveryStartTime = Date.now();
      const response = await this.deliverWebhook(webhookUrl, payload, isVoice);
      const deliveryDuration = Date.now() - deliveryStartTime;

      // Step 4: Track metrics
      this.deliveryCount++;
      this.totalDeliveryTime += deliveryDuration;
      this.resetCircuitBreaker(workflowId);

      const totalDuration = Date.now() - startTime;
      this.logger.log(
        `Webhook delivered successfully for workflow ${workflowId} in ${deliveryDuration}ms (total: ${totalDuration}ms)`
      );

      // Log warning if delivery exceeded voice threshold
      if (isVoice && deliveryDuration > 500) {
        this.logger.warn(
          `Voice webhook delivery exceeded target latency: ${deliveryDuration}ms (target < 500ms)`
        );
      }

      return {
        success: true,
        deliveryTime: deliveryDuration,
        totalTime: totalDuration,
        response: response.data,
      };

    } catch (error) {
      const err = error as Error;
      const duration = Date.now() - startTime;
      
      this.logger.error(
        `Webhook delivery failed for workflow ${workflowId} after ${duration}ms: ${err.message}`,
        err.stack
      );

      // Increment circuit breaker failure count
      this.incrementFailureCount(workflowId);

      // For voice workflows, trigger fallback after max retries
      if (isVoice && job.attemptsMade >= 2) {
        this.logger.warn(
          `Max retries reached for voice workflow ${workflowId}, triggering fallback`
        );
        this.fallbackCount++;
        return { fallback: true, message: this.FALLBACK_MESSAGE };
      }

      throw error;
    }
  }

  /**
   * Get webhook URL from cache or database
   */
  private async getWebhookUrl(workflowId: string, isVoice: boolean): Promise<string | null> {
    try {
      // Try cache first
      const cachedUrl = await this.cacheService.getWebhookUrl(workflowId, isVoice);
      
      if (cachedUrl) {
        return cachedUrl;
      }

      // Cache miss - this should rarely happen if backend is pre-warming correctly
      this.logger.warn(
        `Cache miss for ${isVoice ? 'voice' : 'non-voice'} workflow ${workflowId}`
      );

      // For now, return null and let the job fail
      // In production, you might want to query the database here
      return null;

    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Error retrieving webhook URL for workflow ${workflowId}: ${err.message}`
      );
      return null;
    }
  }

  /**
   * Deliver payload to webhook endpoint
   * 
   * IMPORTANT: This uses POST method for webhook delivery.
   * Ensure your n8n webhook node is configured to accept POST requests:
   * - HTTP Method: POST (or ALL)
   * - Path: /webhook/your-webhook-id
   * - Webhook must be activated (not in test mode)
   */
  private async deliverWebhook(
    webhookUrl: string,
    payload: any,
    isVoice: boolean
  ): Promise<any> {
    try {
      const timeout = isVoice ? this.WEBHOOK_TIMEOUT_MS : 10000; // 10s for non-voice

      // Use POST method for webhook delivery (standard for webhooks)
      const response = await axios.post(webhookUrl, payload, {
        timeout,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Jibu-Webhook-Delivery/1.0',
          'X-Jibu-Voice': isVoice ? 'true' : 'false',
        },
        validateStatus: (status) => status >= 200 && status < 300,
      });

      return response;

    } catch (error) {
      const axiosError = error as AxiosError;
      
      if (axiosError.code === 'ECONNABORTED') {
        throw new Error(`Webhook delivery timeout after ${this.WEBHOOK_TIMEOUT_MS}ms`);
      }

      if (axiosError.response) {
        throw new Error(
          `Webhook returned error status ${axiosError.response.status}: ${axiosError.response.statusText}`
        );
      }

      if (axiosError.request) {
        throw new Error(`No response received from webhook: ${axiosError.message}`);
      }

      throw new Error(`Webhook delivery error: ${axiosError.message}`);
    }
  }

  /**
   * Check if circuit breaker should be triggered
   */
  private shouldTriggerCircuitBreaker(workflowId: string): boolean {
    const failures = this.failureCount.get(workflowId) || 0;
    return failures >= this.circuitBreakerThreshold;
  }

  /**
   * Increment failure count for circuit breaker
   */
  private incrementFailureCount(workflowId: string): void {
    const current = this.failureCount.get(workflowId) || 0;
    this.failureCount.set(workflowId, current + 1);

    // Reset after timeout
    setTimeout(() => {
      this.failureCount.delete(workflowId);
    }, this.circuitBreakerResetTime);
  }

  /**
   * Reset circuit breaker on success
   */
  private resetCircuitBreaker(workflowId: string): void {
    this.failureCount.delete(workflowId);
  }

  /**
   * Log delivery metrics
   */
  private logMetrics(): void {
    const avgDeliveryTime = this.deliveryCount > 0 
      ? (this.totalDeliveryTime / this.deliveryCount).toFixed(2) 
      : 0;

    const fallbackRate = this.deliveryCount > 0
      ? ((this.fallbackCount / this.deliveryCount) * 100).toFixed(2)
      : 0;

    this.logger.log(
      `Webhook Delivery Metrics: ` +
      `Total: ${this.deliveryCount}, ` +
      `Failures: ${this.failureCountTotal}, ` +
      `Fallbacks: ${this.fallbackCount} (${fallbackRate}%), ` +
      `Avg Delivery Time: ${avgDeliveryTime}ms`
    );
  }
}
