import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';

/**
 * Cached webhook URL entry
 */
export interface CachedWebhookUrl {
  webhookUrl: string;
  workflowId: string;
  resolvedAt: number; // Timestamp
  isVoiceWorkflow?: boolean;
}

/**
 * Redis service interface for dependency injection
 */
export interface IRedisService {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, expirySeconds?: number): Promise<boolean>;
  del(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
}

// Reusable injection token for providing a Redis-like service
export const REDIS_SERVICE_TOKEN = 'REDIS_SERVICE';

/**
 * Three-layer caching system for webhook URLs
 * Layer 1: In-Memory Cache (5 min TTL, 100 entry limit)
 * Layer 2: Redis Cache (1 hour TTL with auto-renew)
 * Layer 3: Database (Source of Truth)
 * 
 * This is a shared library used by both backend and worker
 */
@Injectable()
export class WebhookCacheService implements OnModuleInit {
  private readonly logger = new Logger(WebhookCacheService.name);

  // Layer 1: In-Memory Cache
  private readonly memoryCache = new Map<string, CachedWebhookUrl>();
  private readonly memoryCacheTTL = 5 * 60 * 1000; // 5 minutes
  private readonly maxMemoryCacheSize = 100;
  private readonly cacheAccessTimes = new Map<string, number>(); // For LRU eviction

  // Layer 2: Redis Cache TTLs
  private readonly voiceRedisCacheTTL = 60 * 60; // 1 hour for voice workflows
  private readonly nonVoiceRedisCacheTTL = 30 * 60; // 30 minutes for non-voice
  private readonly connectionContextTTL = 5 * 60; // 5 minutes for active connections

  // Cache key prefixes
  private readonly REDIS_KEY_PREFIX = 'webhook:url:';
  private readonly VOICE_REDIS_KEY_PREFIX = 'voice:webhook:url:';
  private readonly VERSION_KEY_PREFIX = 'webhook:version:';
  private readonly CONNECTION_KEY_PREFIX = 'voice:connection:';
  private readonly CONNECTION_INDEX_PREFIX = 'voice:connection:index:';

  // Circuit breaker for repeated failures
  private readonly failureCount = new Map<string, number>();
  private readonly circuitBreakerThreshold = 3;
  private readonly circuitBreakerResetTime = 5 * 60 * 1000; // 5 minutes
  private readonly failureTimestamps = new Map<string, number>();

  // Metrics
  private cacheHits = 0;
  private cacheMisses = 0;
  private voiceCacheHits = 0;
  private voiceCacheMisses = 0;
  private memoryHits = 0;
  private redisHits = 0;

  constructor(@Inject(REDIS_SERVICE_TOKEN) private readonly redisService: IRedisService) {}

  onModuleInit() {
    this.logger.log('WebhookCacheService initialized');
    // Start periodic cleanup of in-memory cache
    this.startCacheCleanup();
    // Log metrics every 5 minutes
    this.startMetricsLogging();
  }

  /**
   * Get webhook URL from cache (does not query database)
   * Returns null if not in cache
   * @param workflowId - The workflow ID
   * @param isVoiceWorkflow - Whether this is a voice workflow (affects caching strategy)
   */
  async getWebhookUrl(
    workflowId: string,
    isVoiceWorkflow: boolean = false,
  ): Promise<string | null> {
    const startTime = Date.now();

    try {
      // Layer 1: Check in-memory cache (voice workflows only for fastest access)
      if (isVoiceWorkflow) {
        const memoryResult = this.getFromMemoryCache(workflowId);
        if (memoryResult) {
          this.recordCacheHit('memory', isVoiceWorkflow, Date.now() - startTime);
          return memoryResult.webhookUrl;
        }
      }

      // Layer 2: Check Redis cache
      const redisResult = await this.getFromRedisCache(workflowId, isVoiceWorkflow);
      if (redisResult) {
        // Populate memory cache for voice workflows
        if (isVoiceWorkflow) {
          this.setInMemoryCache(workflowId, redisResult);
        }
        this.recordCacheHit('redis', isVoiceWorkflow, Date.now() - startTime);
        return redisResult.webhookUrl;
      }

      // Cache miss - caller should query database and call setWebhookUrl
      this.recordCacheMiss(isVoiceWorkflow);
      return null;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Error getting webhook URL from cache for workflow ${workflowId}: ${err.message}`,
        err.stack
      );
      this.incrementFailureCount(workflowId);
      return null;
    }
  }

  /**
   * Set webhook URL in cache
   * @param workflowId - The workflow ID
   * @param webhookUrl - The webhook URL to cache
   * @param isVoiceWorkflow - Whether this is a voice workflow
   */
  async setWebhookUrl(
    workflowId: string,
    webhookUrl: string,
    isVoiceWorkflow: boolean = false,
  ): Promise<void> {
    try {
      const cached: CachedWebhookUrl = {
        webhookUrl,
        workflowId,
        resolvedAt: Date.now(),
        isVoiceWorkflow,
      };

      // Set in Redis cache
      await this.setInRedisCache(workflowId, cached, isVoiceWorkflow);

      // Set in memory cache for voice workflows
      if (isVoiceWorkflow) {
        this.setInMemoryCache(workflowId, cached);
      }

      this.logger.debug(`Webhook URL cached for workflow ${workflowId}`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Error setting webhook URL in cache for workflow ${workflowId}: ${err.message}`
      );
    }
  }

  /**
   * Invalidate cache for a workflow
   */
  async invalidate(workflowId: string): Promise<void> {
    try {
      // Remove from memory cache
      this.memoryCache.delete(workflowId);
      this.cacheAccessTimes.delete(workflowId);

      // Remove from Redis cache (both voice and non-voice keys)
      await this.redisService.del(`${this.REDIS_KEY_PREFIX}${workflowId}`);
      await this.redisService.del(`${this.VOICE_REDIS_KEY_PREFIX}${workflowId}`);
      await this.redisService.del(`${this.VERSION_KEY_PREFIX}${workflowId}`);

      this.logger.log(`Cache invalidated for workflow ${workflowId}`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Error invalidating cache for workflow ${workflowId}: ${err.message}`
      );
    }
  }

  /**
   * Invalidate cache and return a signal that refresh is needed
   * The caller should refresh from the source and call setWebhookUrl
   */
  async refreshAndInvalidate(workflowId: string): Promise<void> {
    await this.invalidate(workflowId);
    this.logger.log(`Cache invalidated for workflow ${workflowId}, refresh needed`);
  }

  /**
   * Pre-warm cache for active voice workflows
   * Should be called when a voice agent is activated
   */
  async prewarmCache(workflowId: string, webhookUrl: string): Promise<void> {
    try {
      this.logger.log(`Pre-warming cache for voice workflow ${workflowId}`);
      await this.setWebhookUrl(workflowId, webhookUrl, true);
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Error pre-warming cache for workflow ${workflowId}: ${err.message}`
      );
    }
  }

  /**
   * Check if circuit breaker should be triggered
   */
  shouldTriggerCircuitBreaker(workflowId: string): boolean {
    const failures = this.failureCount.get(workflowId) || 0;
    const lastFailure = this.failureTimestamps.get(workflowId) || 0;
    
    // Reset if enough time has passed
    if (Date.now() - lastFailure > this.circuitBreakerResetTime) {
      this.failureCount.delete(workflowId);
      this.failureTimestamps.delete(workflowId);
      return false;
    }

    return failures >= this.circuitBreakerThreshold;
  }

  /**
   * Reset circuit breaker for a workflow (call after successful operation)
   */
  resetCircuitBreaker(workflowId: string): void {
    this.failureCount.delete(workflowId);
    this.failureTimestamps.delete(workflowId);
  }

  /**
   * Get cache metrics
   */
  getMetrics() {
    const totalHits = this.cacheHits;
    const totalRequests = totalHits + this.cacheMisses;
    const hitRate = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;

    const voiceTotal = this.voiceCacheHits + this.voiceCacheMisses;
    const voiceHitRate = voiceTotal > 0 ? (this.voiceCacheHits / voiceTotal) * 100 : 0;

    return {
      totalHits,
      totalMisses: this.cacheMisses,
      totalRequests,
      hitRate: hitRate.toFixed(2) + '%',
      voiceHits: this.voiceCacheHits,
      voiceMisses: this.voiceCacheMisses,
      voiceHitRate: voiceHitRate.toFixed(2) + '%',
      memoryHits: this.memoryHits,
      redisHits: this.redisHits,
      memoryCacheSize: this.memoryCache.size,
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Get from in-memory cache
   */
  private getFromMemoryCache(workflowId: string): CachedWebhookUrl | null {
    const cached = this.memoryCache.get(workflowId);
    if (!cached) {
      return null;
    }

    // Check if expired
    const age = Date.now() - cached.resolvedAt;
    if (age > this.memoryCacheTTL) {
      this.memoryCache.delete(workflowId);
      this.cacheAccessTimes.delete(workflowId);
      return null;
    }

    // Update access time for LRU
    this.cacheAccessTimes.set(workflowId, Date.now());

    return cached;
  }

  /**
   * Set in-memory cache with LRU eviction
   */
  private setInMemoryCache(workflowId: string, cached: CachedWebhookUrl): void {
    // Evict least recently used if cache is full
    if (this.memoryCache.size >= this.maxMemoryCacheSize) {
      this.evictLRU();
    }

    this.memoryCache.set(workflowId, cached);
    this.cacheAccessTimes.set(workflowId, Date.now());
  }

  /**
   * Evict least recently used entry from memory cache
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, time] of this.cacheAccessTimes.entries()) {
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.memoryCache.delete(oldestKey);
      this.cacheAccessTimes.delete(oldestKey);
      this.logger.debug(`Evicted LRU entry from memory cache: ${oldestKey}`);
    }
  }

  /**
   * Get from Redis cache
   */
  private async getFromRedisCache(
    workflowId: string,
    isVoiceWorkflow: boolean,
  ): Promise<CachedWebhookUrl | null> {
    try {
      const prefix = isVoiceWorkflow ? this.VOICE_REDIS_KEY_PREFIX : this.REDIS_KEY_PREFIX;
      const key = `${prefix}${workflowId}`;
      const cached = await this.redisService.get(key);

      if (!cached) {
        return null;
      }

      const parsed = JSON.parse(cached) as CachedWebhookUrl;

      // Auto-renew TTL on access
      const ttl = isVoiceWorkflow ? this.voiceRedisCacheTTL : this.nonVoiceRedisCacheTTL;
      await this.redisService.set(key, cached, ttl);

      return parsed;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Error getting from Redis cache for workflow ${workflowId}: ${err.message}`
      );
      return null;
    }
  }

  /**
   * Set in Redis cache with random jitter for cache stampede protection
   */
  private async setInRedisCache(
    workflowId: string,
    cached: CachedWebhookUrl,
    isVoiceWorkflow: boolean,
  ): Promise<void> {
    try {
      const prefix = isVoiceWorkflow ? this.VOICE_REDIS_KEY_PREFIX : this.REDIS_KEY_PREFIX;
      const key = `${prefix}${workflowId}`;
      const baseTtl = isVoiceWorkflow ? this.voiceRedisCacheTTL : this.nonVoiceRedisCacheTTL;

      // Add random jitter (±10%) for cache stampede protection
      const jitter = Math.floor(baseTtl * 0.1 * (Math.random() * 2 - 1));
      const ttl = baseTtl + jitter;

      await this.redisService.set(key, JSON.stringify(cached), ttl);
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Error setting Redis cache for workflow ${workflowId}: ${err.message}`
      );
    }
  }

  /**
   * Record cache hit
   */
  private recordCacheHit(layer: 'memory' | 'redis', isVoice: boolean, latencyMs: number): void {
    this.cacheHits++;
    if (isVoice) {
      this.voiceCacheHits++;
    }
    if (layer === 'memory') {
      this.memoryHits++;
    } else {
      this.redisHits++;
    }

    // Log if latency exceeds voice threshold
    if (isVoice && latencyMs > 10) {
      this.logger.warn(
        `Voice workflow cache hit latency exceeded threshold: ${latencyMs}ms (target < 10ms)`
      );
    }
  }

  /**
   * Record cache miss
   */
  private recordCacheMiss(isVoice: boolean): void {
    this.cacheMisses++;
    if (isVoice) {
      this.voiceCacheMisses++;
    }
  }

  /**
   * Increment failure count for circuit breaker
   */
  private incrementFailureCount(workflowId: string): void {
    const current = this.failureCount.get(workflowId) || 0;
    this.failureCount.set(workflowId, current + 1);
    this.failureTimestamps.set(workflowId, Date.now());
  }

  /**
   * Start periodic cleanup of expired in-memory cache entries
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      let cleaned = 0;

      for (const [workflowId, cached] of this.memoryCache.entries()) {
        const age = now - cached.resolvedAt;
        if (age > this.memoryCacheTTL) {
          this.memoryCache.delete(workflowId);
          this.cacheAccessTimes.delete(workflowId);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        this.logger.debug(`Cleaned ${cleaned} expired entries from memory cache`);
      }
    }, 60 * 1000); // Run every minute
  }

  /**
   * Start periodic metrics logging
   */
  private startMetricsLogging(): void {
    setInterval(() => {
      const metrics = this.getMetrics();
      this.logger.log(`Cache Metrics: ${JSON.stringify(metrics)}`);
    }, 5 * 60 * 1000); // Log every 5 minutes
  }

  // ============================================================================
  // Connection Context Management (Voice-Specific)
  // ============================================================================

  /**
   * Store connection context for an active voice call
   * @param connectionId - Unique connection identifier
   * @param context - Connection context data
   */
  async setConnectionContext(connectionId: string, context: any): Promise<void> {
    try {
      const key = `${this.CONNECTION_KEY_PREFIX}${connectionId}`;
      const indexKey = `${this.CONNECTION_INDEX_PREFIX}${context.workflowId}:${context.sessionId}`;
      
      // Store connection context with 5-minute TTL
      await this.redisService.set(key, JSON.stringify(context), this.connectionContextTTL);
      
      // Store index mapping for lookup by workflowId + sessionId
      await this.redisService.set(indexKey, connectionId, this.connectionContextTTL);
      
      this.logger.debug(`Connection context stored for ${connectionId}`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Error storing connection context for ${connectionId}: ${err.message}`
      );
    }
  }

  /**
   * Get connection context by connection ID
   * @param connectionId - Unique connection identifier
   */
  async getConnectionContext(connectionId: string): Promise<any | null> {
    try {
      const key = `${this.CONNECTION_KEY_PREFIX}${connectionId}`;
      const cached = await this.redisService.get(key);
      
      if (!cached) {
        return null;
      }
      
      return JSON.parse(cached);
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Error getting connection context for ${connectionId}: ${err.message}`
      );
      return null;
    }
  }

  /**
   * Get connection context by workflow ID and session ID
   * @param workflowId - The workflow ID
   * @param sessionId - The session ID
   */
  async getConnectionContextBySession(
    workflowId: string,
    sessionId: string
  ): Promise<any | null> {
    try {
      const indexKey = `${this.CONNECTION_INDEX_PREFIX}${workflowId}:${sessionId}`;
      const connectionId = await this.redisService.get(indexKey);
      
      if (!connectionId) {
        return null;
      }
      
      return this.getConnectionContext(connectionId);
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Error getting connection context for workflow ${workflowId}, session ${sessionId}: ${err.message}`
      );
      return null;
    }
  }

  /**
   * Update connection heartbeat
   * @param connectionId - Unique connection identifier
   */
  async updateConnectionHeartbeat(connectionId: string): Promise<void> {
    try {
      const context = await this.getConnectionContext(connectionId);
      
      if (!context) {
        this.logger.warn(`Connection context not found for heartbeat update: ${connectionId}`);
        return;
      }
      
      context.lastHeartbeat = Date.now();
      await this.setConnectionContext(connectionId, context);
      
      this.logger.debug(`Heartbeat updated for connection ${connectionId}`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Error updating heartbeat for ${connectionId}: ${err.message}`
      );
    }
  }

  /**
   * Remove connection context (call ended or failed)
   * @param connectionId - Unique connection identifier
   */
  async removeConnectionContext(connectionId: string): Promise<void> {
    try {
      const context = await this.getConnectionContext(connectionId);
      
      if (context) {
        const indexKey = `${this.CONNECTION_INDEX_PREFIX}${context.workflowId}:${context.sessionId}`;
        await this.redisService.del(indexKey);
      }
      
      const key = `${this.CONNECTION_KEY_PREFIX}${connectionId}`;
      await this.redisService.del(key);
      
      this.logger.log(`Connection context removed for ${connectionId}`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Error removing connection context for ${connectionId}: ${err.message}`
      );
    }
  }

  /**
   * Check if a connection is still active
   * @param connectionId - Unique connection identifier
   * @param maxIdleMs - Maximum idle time in milliseconds (default 30 seconds)
   */
  async isConnectionActive(connectionId: string, maxIdleMs: number = 30000): Promise<boolean> {
    try {
      const context = await this.getConnectionContext(connectionId);
      
      if (!context) {
        return false;
      }
      
      const idleTime = Date.now() - context.lastHeartbeat;
      return idleTime < maxIdleMs && context.isActive;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Error checking connection status for ${connectionId}: ${err.message}`
      );
      return false;
    }
  }
}
