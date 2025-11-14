import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, JobOptions } from 'bull';
import { 
  QUEUE_NAMES, 
  JOB_NAMES, 
  WebhookDeliveryJobData,
  WebhookPayload,
  WebhookPriority,
  VoiceMetadata,
  CallEventData,
  AiContext,
  ConversationMessage,
  ConnectionContextData,
} from '@jibu/queue-definitions';
import { WebhookCacheService } from '@jibu/cache-utils';
import { ConnectionService } from './connection.service';
import { RagContextService } from './rag-context.service';

/**
 * Service for enqueuing webhook delivery jobs
 * Phase 3: Implements complete payload structure with conversation context
 * Optimized for voice workflows with sub-500ms delivery targets
 */
@Injectable()
export class MessageQueueService {
  private readonly logger = new Logger(MessageQueueService.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.WEBHOOK_DELIVERY) private readonly webhookQueue: Queue,
    private readonly cacheService: WebhookCacheService,
    private readonly connectionService: ConnectionService,
    private readonly ragContextService: RagContextService,
  ) {}

  /**
   * Send a text message to a workflow via webhook
   * Builds complete payload with conversation context
   * @param workflowId - The workflow ID
   * @param sessionId - The session ID
   * @param text - The user's message text
   * @param aiContext - Optional AI context (system prompt, conversation history, etc.)
   * @param options - Optional job options
   */
  async sendMessageToWorkflow(
    workflowId: string,
    sessionId: string,
    text: string,
    aiContext?: Partial<AiContext>,
    options?: JobOptions
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Validate that webhook URL exists in cache
      const webhookUrl = await this.cacheService.getWebhookUrl(workflowId, false);
      
      if (!webhookUrl) {
        this.logger.warn(
          `Webhook URL not in cache for workflow ${workflowId}, will be fetched by worker`
        );
      }

      // Check circuit breaker
      if (this.cacheService.shouldTriggerCircuitBreaker(workflowId)) {
        this.logger.error(
          `Circuit breaker triggered for workflow ${workflowId}, rejecting message`
        );
        throw new Error(`Circuit breaker open for workflow ${workflowId}`);
      }

      // Build complete webhook payload
      const payload: WebhookPayload = await this.buildMessagePayload(
        workflowId,
        sessionId,
        text,
        false, // isVoice
        undefined, // voiceMetadata
        aiContext
      );

      // Prepare job data
      const jobData: WebhookDeliveryJobData = {
        workflowId,
        sessionId,
        payload,
        isVoice: false,
        priority: WebhookPriority.CHAT_MESSAGES,
      };

      // Enqueue with chat priority
      const job = await this.webhookQueue.add(JOB_NAMES.DELIVER_WEBHOOK, jobData, {
        priority: WebhookPriority.CHAT_MESSAGES,
        ...options,
      });

      const duration = Date.now() - startTime;
      this.logger.log(
        `Chat message enqueued for workflow ${workflowId}, session ${sessionId}, job ${job.id} in ${duration}ms`
      );

      // Log warning if enqueuing took too long
      if (duration > 100) {
        this.logger.warn(
          `Message enqueuing exceeded target latency: ${duration}ms (target < 100ms)`
        );
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to enqueue message for workflow ${workflowId}: ${err.message}`,
        err.stack
      );
      throw error;
    }
  }

  /**
   * Send a voice message to a workflow via webhook
   * Includes voice metadata and optimized for sub-500ms delivery
   * @param workflowId - The workflow ID
   * @param sessionId - The session ID
   * @param text - The transcribed text
   * @param voiceMetadata - Voice quality metrics
   * @param aiContext - Optional AI context
   * @param connectionId - Optional connection ID for tracking
   * @param options - Optional job options
   */
  async sendVoiceMessageToWorkflow(
    workflowId: string,
    sessionId: string,
    text: string,
    voiceMetadata: VoiceMetadata,
    aiContext?: Partial<AiContext>,
    connectionId?: string,
    options?: JobOptions
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Pre-warm cache for voice workflow
      const webhookUrl = await this.cacheService.getWebhookUrl(workflowId, true);
      
      if (!webhookUrl) {
        this.logger.warn(
          `Webhook URL not in cache for voice workflow ${workflowId}, will be fetched by worker`
        );
      }

      // Check circuit breaker
      if (this.cacheService.shouldTriggerCircuitBreaker(workflowId)) {
        this.logger.error(
          `Circuit breaker triggered for voice workflow ${workflowId}, rejecting message`
        );
        throw new Error(`Circuit breaker open for workflow ${workflowId}`);
      }

      // Validate connection context if provided
      let connectionContext: ConnectionContextData | undefined;
      if (connectionId) {
        const connection = await this.connectionService.getConnection(connectionId);
        if (connection && connection.isActive) {
          connectionContext = {
            startTime: connection.startTime,
            callSid: connection.callSid || '',
          };
        }
      }

      // Build complete webhook payload
      const payload: WebhookPayload = await this.buildMessagePayload(
        workflowId,
        sessionId,
        text,
        true, // isVoice
        voiceMetadata,
        aiContext,
        connectionContext
      );

      // Prepare job data with voice priority
      const jobData: WebhookDeliveryJobData = {
        workflowId,
        sessionId,
        payload,
        isVoice: true,
        connectionId,
        priority: WebhookPriority.VOICE_MESSAGES,
      };

      // Enqueue with voice message priority
      const job = await this.webhookQueue.add(JOB_NAMES.DELIVER_WEBHOOK, jobData, {
        priority: WebhookPriority.VOICE_MESSAGES,
        attempts: 2, // Only 2 attempts for voice
        timeout: 5000, // 5-second timeout
        ...options,
      });

      const duration = Date.now() - startTime;
      this.logger.log(
        `Voice message enqueued for workflow ${workflowId}, session ${sessionId}, job ${job.id} in ${duration}ms`
      );

      // Log warning if enqueuing exceeded voice threshold
      if (duration > 50) {
        this.logger.warn(
          `Voice message enqueuing exceeded target latency: ${duration}ms (target < 50ms)`
        );
      }

      // Update connection heartbeat if provided
      if (connectionId) {
        await this.connectionService.updateHeartbeat(connectionId);
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to enqueue voice message for workflow ${workflowId}: ${err.message}`,
        err.stack
      );
      throw error;
    }
  }

  /**
   * Send a call event to a voice workflow via webhook
   * Highest priority for call lifecycle events (incoming, answered, hangup)
   * @param workflowId - The workflow ID
   * @param sessionId - The session ID
   * @param callEvent - The call event data
   * @param aiContext - Optional AI context
   * @param connectionId - Optional connection ID for tracking
   * @param options - Optional job options
   */
  async sendCallEventToWorkflow(
    workflowId: string,
    sessionId: string,
    callEvent: CallEventData,
    aiContext?: Partial<AiContext>,
    connectionId?: string,
    options?: JobOptions
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Validate connection context if provided
      let connectionContext: ConnectionContextData | undefined;
      if (connectionId) {
        const connection = await this.connectionService.getConnection(connectionId);
        
        if (!connection) {
          this.logger.warn(
            `Connection ${connectionId} not found, proceeding without validation`
          );
        } else if (!connection.isActive) {
          this.logger.warn(
            `Connection ${connectionId} is not active, event may be rejected`
          );
        } else {
          connectionContext = {
            startTime: connection.startTime,
            callSid: connection.callSid || '',
          };
        }
      }

      // Pre-warm cache for voice workflow
      const webhookUrl = await this.cacheService.getWebhookUrl(workflowId, true);
      
      if (!webhookUrl) {
        this.logger.warn(
          `Webhook URL not in cache for voice workflow ${workflowId}, will be fetched by worker`
        );
      }

      // Check circuit breaker
      if (this.cacheService.shouldTriggerCircuitBreaker(workflowId)) {
        this.logger.error(
          `Circuit breaker triggered for voice workflow ${workflowId}, rejecting event`
        );
        throw new Error(`Circuit breaker open for workflow ${workflowId}`);
      }

      // Build complete webhook payload for call event
      const payload: WebhookPayload = await this.buildCallEventPayload(
        workflowId,
        sessionId,
        callEvent,
        aiContext,
        connectionContext
      );

      // Prepare job data with highest priority
      const jobData: WebhookDeliveryJobData = {
        workflowId,
        sessionId,
        payload,
        isVoice: true,
        connectionId,
        priority: WebhookPriority.VOICE_EVENTS,
      };

      // Enqueue with highest priority
      const job = await this.webhookQueue.add(JOB_NAMES.DELIVER_WEBHOOK, jobData, {
        priority: WebhookPriority.VOICE_EVENTS,
        attempts: 2, // Only 2 attempts for voice
        timeout: 5000, // 5-second timeout
        ...options,
      });

      const duration = Date.now() - startTime;
      this.logger.log(
        `Call event (${callEvent.type}) enqueued for workflow ${workflowId}, session ${sessionId}, job ${job.id} in ${duration}ms`
      );

      // Log warning if enqueuing exceeded voice threshold
      if (duration > 50) {
        this.logger.warn(
          `Call event enqueuing exceeded target latency: ${duration}ms (target < 50ms)`
        );
      }

      // Update connection heartbeat if provided
      if (connectionId) {
        await this.connectionService.updateHeartbeat(connectionId);
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to enqueue call event for workflow ${workflowId}: ${err.message}`,
        err.stack
      );
      throw error;
    }
  }

  /**
   * Build complete message payload with conversation context
   * Private helper method for payload assembly
   */
  private async buildMessagePayload(
    workflowId: string,
    sessionId: string,
    text: string,
    isVoice: boolean,
    voiceMetadata?: VoiceMetadata,
    aiContext?: Partial<AiContext>,
    connectionContext?: ConnectionContextData
  ): Promise<WebhookPayload> {
    // Get RAG context (currently returns empty placeholder)
    const ragContext = await this.ragContextService.getRagContext(text);

    // Build complete AI context
    const completeAiContext: AiContext = {
      systemPrompt: aiContext?.systemPrompt || '',
      systemMessage: aiContext?.systemMessage || '',
      conversationHistory: aiContext?.conversationHistory || [],
      ragContext,
    };

    // Assemble complete payload
    const payload: WebhookPayload = {
      eventType: 'message',
      sessionId,
      workflowId,
      timestamp: Date.now(),
      text,
      isVoice,
      aiContext: completeAiContext,
    };

    // Add voice metadata if provided
    if (voiceMetadata) {
      payload.voiceMetadata = voiceMetadata;
    }

    // Add connection context if provided
    if (connectionContext) {
      payload.connectionContext = connectionContext;
    }

    return payload;
  }

  /**
   * Build complete call event payload
   * Private helper method for call event assembly
   */
  private async buildCallEventPayload(
    workflowId: string,
    sessionId: string,
    callEvent: CallEventData,
    aiContext?: Partial<AiContext>,
    connectionContext?: ConnectionContextData
  ): Promise<WebhookPayload> {
    // Get RAG context (currently returns empty placeholder)
    const ragContext = await this.ragContextService.getRagContext('');

    // Build complete AI context
    const completeAiContext: AiContext = {
      systemPrompt: aiContext?.systemPrompt || '',
      systemMessage: aiContext?.systemMessage || '',
      conversationHistory: aiContext?.conversationHistory || [],
      ragContext,
    };

    // Assemble complete payload
    const payload: WebhookPayload = {
      eventType: 'call',
      sessionId,
      workflowId,
      timestamp: Date.now(),
      callEvent,
      aiContext: completeAiContext,
    };

    // Add connection context if provided
    if (connectionContext) {
      payload.connectionContext = connectionContext;
    }

    return payload;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.webhookQueue.getWaitingCount(),
      this.webhookQueue.getActiveCount(),
      this.webhookQueue.getCompletedCount(),
      this.webhookQueue.getFailedCount(),
      this.webhookQueue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + delayed,
    };
  }

  /**
   * Get queue health status
   */
  async getQueueHealth(): Promise<{ healthy: boolean; reason?: string }> {
    try {
      const stats = await this.getQueueStats();

      // Queue is unhealthy if too many jobs are waiting
      if (stats.waiting > 100) {
        return {
          healthy: false,
          reason: `Too many waiting jobs: ${stats.waiting}`,
        };
      }

      // Queue is unhealthy if too many jobs have failed
      if (stats.failed > 50) {
        return {
          healthy: false,
          reason: `Too many failed jobs: ${stats.failed}`,
        };
      }

      return { healthy: true };
    } catch (error) {
      const err = error as Error;
      return {
        healthy: false,
        reason: `Queue health check failed: ${err.message}`,
      };
    }
  }

  /**
   * Pause the queue (for maintenance)
   */
  async pauseQueue(): Promise<void> {
    await this.webhookQueue.pause();
    this.logger.warn('Webhook delivery queue paused');
  }

  /**
   * Resume the queue
   */
  async resumeQueue(): Promise<void> {
    await this.webhookQueue.resume();
    this.logger.log('Webhook delivery queue resumed');
  }

  /**
   * Clean completed jobs from the queue
   */
  async cleanCompletedJobs(olderThanMs: number = 60000): Promise<void> {
    await this.webhookQueue.clean(olderThanMs, 'completed');
    this.logger.log(`Cleaned completed jobs older than ${olderThanMs}ms`);
  }

  /**
   * Clean failed jobs from the queue
   */
  async cleanFailedJobs(olderThanMs: number = 3600000): Promise<void> {
    await this.webhookQueue.clean(olderThanMs, 'failed');
    this.logger.log(`Cleaned failed jobs older than ${olderThanMs}ms`);
  }
}
