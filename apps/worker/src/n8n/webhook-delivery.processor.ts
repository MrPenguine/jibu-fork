import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Job } from 'bull';
import { ConfigService } from '@nestjs/config';
import { 
  QUEUE_NAMES, 
  JOB_NAMES, 
  WebhookPayload,
} from '@jibu/queue-definitions';
import { WebhookCacheService } from '@jibu/cache-utils';
import axios, { AxiosError } from 'axios';
import { WebhookUrlService } from '../../../backend/src/core/webhook/webhook-url.service';

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
    private readonly webhookCacheService: WebhookCacheService,
    private readonly configService: ConfigService,
    private readonly webhookUrlService: WebhookUrlService,
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
  onActive(job: Job<WebhookPayload>) {
    const payload = job.data;
    const { workflowId, sessionId } = payload;
    const isVoice = payload.eventType === 'call' || (payload as any).isVoice === true;
    this.logger.debug(
      `Job ${job.id} active - Delivering ${isVoice ? 'voice' : 'non-voice'} webhook for workflow ${workflowId}, session ${sessionId}`
    );
  }

  @OnQueueCompleted()
  onCompleted(job: Job<WebhookPayload>, result: any) {
    const payload = job.data;
    const { workflowId } = payload;
    const isVoice = payload.eventType === 'call' || (payload as any).isVoice === true;
    this.logger.log(
      `Job ${job.id} completed - ${isVoice ? 'Voice' : 'Non-voice'} webhook delivered for workflow ${workflowId}`
    );
  }

  @OnQueueFailed()
  onFailed(job: Job<WebhookPayload>, err: Error) {
    const payload = job.data;
    const { workflowId, sessionId } = payload;
    const isVoice = payload.eventType === 'call' || (payload as any).isVoice === true;
    this.logger.error(
      `Job ${job.id} failed - ${isVoice ? 'Voice' : 'Non-voice'} webhook delivery failed for workflow ${workflowId}, session ${sessionId}: ${err.message}`,
      err.stack
    );
    this.failureCountTotal++;
  }

  @Process(JOB_NAMES.DELIVER_WEBHOOK)
  async handle(job: Job<WebhookPayload>) {
    const startTime = Date.now();
    const payload = job.data;
    const { workflowId, sessionId } = payload;
    const isVoice = payload.eventType === 'call' || (payload as any).isVoice === true;
    const priority = job.opts.priority;

    try {
      // Validate critical fields — prevent silent failures
      if (!sessionId || !workflowId) {
        throw new Error('Invalid webhook payload: missing sessionId or workflowId');
      }

      // Log payload structure for debugging
      this.logger.log(
        `Processing webhook delivery job ${job.id} for workflow ${workflowId}, session ${sessionId}, ` +
        `eventType: ${payload.eventType}, isVoice: ${isVoice}, priority: ${priority}`
      );
      
      // Log additional context for voice events
      if (isVoice && payload.eventType === 'message' && payload.voiceMetadata) {
        this.logger.debug(
          `Voice metadata - confidence: ${payload.voiceMetadata.confidence.toFixed(2)}, ` +
          `language: ${payload.voiceMetadata.language}, duration: ${payload.voiceMetadata.duration}ms`
        );
      }
      
      if (payload.eventType === 'call' && payload.callEvent) {
        this.logger.debug(
          `Call event - type: ${payload.callEvent.type}, from: ${payload.callEvent.from || 'N/A'}, ` +
          `to: ${payload.callEvent.to || 'N/A'}`
        );
      }

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
      const rawWebhookUrl = await this.getWebhookUrl(workflowId, isVoice);
      
      if (!rawWebhookUrl) {
        this.logger.error(`No webhook URL found for workflow ${workflowId}`);
        
        if (isVoice) {
          this.fallbackCount++;
          return { fallback: true, message: this.FALLBACK_MESSAGE };
        }
        
        throw new Error(`No webhook URL found for workflow ${workflowId}`);
      }

      // Normalize the webhook URL to avoid accidental double slashes in the path
      const webhookUrl = this.normalizeWebhookUrl(rawWebhookUrl);

      // Log the resolved webhook URL and a compact view of the payload structure
      const payloadSummary = {
        eventType: payload.eventType,
        hasText: !!(payload as any).text,
        hasVoiceMetadata: !!(payload as any).voiceMetadata,
        hasCallEvent: !!(payload as any).callEvent,
        hasAiContext: !!payload.aiContext,
        conversationHistoryLength: payload.aiContext?.conversationHistory?.length ?? 0,
        ragResultsLength: payload.aiContext?.ragContext?.results?.length ?? 0,
      };
      this.logger.log(
        `Resolved webhook URL for workflow ${workflowId}: ${webhookUrl} | ` +
        `Payload summary: ${JSON.stringify(payloadSummary)}`,
      );

      // Step 3: Deliver complete structured payload to webhook
      // Sending canonical WebhookPayload — no transformation
      this.logger.debug(
        `Delivering ${payload.eventType} for session ${sessionId} (workflow ${workflowId})`,
      );
      const deliveryStartTime = Date.now();
      const response = await this.deliverWebhook(webhookUrl, payload, isVoice);
      const deliveryDuration = Date.now() - deliveryStartTime;
      
      // Log AI context presence for debugging
      if (payload.aiContext) {
        this.logger.debug(
          `AI context included - systemPrompt: ${payload.aiContext.systemPrompt ? 'yes' : 'no'}, ` +
          `conversationHistory: ${payload.aiContext.conversationHistory.length} messages, ` +
          `ragContext: ${payload.aiContext.ragContext.results.length} results`
        );
      }

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
      const cachedUrl = await this.webhookCacheService.getWebhookUrl(workflowId, isVoice);
      
      if (cachedUrl) {
        return cachedUrl;
      }

      // Cache miss - this should rarely happen if backend is pre-warming correctly
      this.logger.warn(
        `Cache miss for ${isVoice ? 'voice' : 'non-voice'} workflow ${workflowId}`
      );

      // Phase 1 100% complete — clean URLs + real DB fallback
      const dbUrl = await this.webhookUrlService.getWebhookUrl(workflowId, isVoice);

      if (dbUrl) {
        this.logger.log(
          `Webhook URL resolved from database for ${isVoice ? 'voice' : 'non-voice'} workflow ${workflowId}`
        );
        return dbUrl;
      }

      this.logger.error(
        `Webhook URL not found in database for workflow ${workflowId}`
      );

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
   * Deliver structured payload to webhook endpoint
   * 
   * IMPORTANT: This uses POST method for webhook delivery.
   * Ensure your n8n webhook node is configured to accept POST requests:
   * - HTTP Method: POST (or ALL)
   * - Path: /webhook/your-webhook-id
   * - Webhook must be activated (not in test mode)
   * 
   * Payload structure includes:
   * - Core event data (eventType, sessionId, workflowId, timestamp)
   * - Message data (text, isVoice, voiceMetadata) OR call event data
   * - AI context (systemPrompt, conversationHistory, RAG context)
   * - Connection context (for active voice calls)
   */
  private async deliverWebhook(
    webhookUrl: string,
    payload: WebhookPayload,
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
          'X-Jibu-Event-Type': payload.eventType,
          'X-Jibu-Session-Id': payload.sessionId,
        },
        validateStatus: (status) => status >= 200 && status < 300,
      });

      return response;

    } catch (error) {
      const axiosError = error as AxiosError;

      if (axiosError.response && axiosError.response.status === 404) {
        const workflowId = payload.workflowId;

        if (workflowId) {
          try {
            await this.webhookCacheService.refreshAndInvalidate(workflowId);
            await this.webhookUrlService.refreshWebhookUrl(workflowId);
            this.logger.warn(
              `Detected stale webhook URL (404) — refreshed from n8n (workflow ${workflowId})`,
            );
          } catch (refreshError) {
            const refreshErr = refreshError as Error;
            this.logger.error(
              `Failed to refresh webhook URL after 404 for workflow ${workflowId}: ${refreshErr.message}`,
              refreshErr.stack,
            );
          }
        } else {
          this.logger.warn(
            'Detected stale webhook URL (404) but payload.workflowId is missing; unable to refresh',
          );
        }
      }

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

  private normalizeWebhookUrl(url: string): string {
    try {
      const parsed = new URL(url);
      // Collapse multiple slashes in the pathname to a single slash
      parsed.pathname = parsed.pathname.replace(/\/+/, '/').replace(/\/{2,}/g, '/');
      return parsed.toString();
    } catch {
      // Fallback: collapse repeated slashes that are not part of the protocol separator
      return url.replace(/([^:])\/{2,}/g, '$1/');
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
