"use strict";
var WebhookCacheService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookCacheService = exports.REDIS_SERVICE_TOKEN = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
exports.REDIS_SERVICE_TOKEN = 'REDIS_SERVICE';
let WebhookCacheService = WebhookCacheService_1 = class WebhookCacheService {
    constructor(redisService) {
        this.redisService = redisService;
        this.logger = new common_1.Logger(WebhookCacheService_1.name);
        this.memoryCache = new Map();
        this.memoryCacheTTL = 5 * 60 * 1000;
        this.maxMemoryCacheSize = 100;
        this.cacheAccessTimes = new Map();
        this.voiceRedisCacheTTL = 60 * 60;
        this.nonVoiceRedisCacheTTL = 30 * 60;
        this.connectionContextTTL = 5 * 60;
        this.REDIS_KEY_PREFIX = 'webhook:url:';
        this.VOICE_REDIS_KEY_PREFIX = 'voice:webhook:url:';
        this.VERSION_KEY_PREFIX = 'webhook:version:';
        this.CONNECTION_KEY_PREFIX = 'voice:connection:';
        this.CONNECTION_INDEX_PREFIX = 'voice:connection:index:';
        this.failureCount = new Map();
        this.circuitBreakerThreshold = 3;
        this.circuitBreakerResetTime = 5 * 60 * 1000;
        this.failureTimestamps = new Map();
        this.cacheHits = 0;
        this.cacheMisses = 0;
        this.voiceCacheHits = 0;
        this.voiceCacheMisses = 0;
        this.memoryHits = 0;
        this.redisHits = 0;
    }
    onModuleInit() {
        this.logger.log('WebhookCacheService initialized');
        this.startCacheCleanup();
        this.startMetricsLogging();
    }
    async getWebhookUrl(workflowId, isVoiceWorkflow = false) {
        const startTime = Date.now();
        try {
            if (isVoiceWorkflow) {
                const memoryResult = this.getFromMemoryCache(workflowId);
                if (memoryResult) {
                    this.recordCacheHit('memory', isVoiceWorkflow, Date.now() - startTime);
                    return memoryResult.webhookUrl;
                }
            }
            const redisResult = await this.getFromRedisCache(workflowId, isVoiceWorkflow);
            if (redisResult) {
                if (isVoiceWorkflow) {
                    this.setInMemoryCache(workflowId, redisResult);
                }
                this.recordCacheHit('redis', isVoiceWorkflow, Date.now() - startTime);
                return redisResult.webhookUrl;
            }
            this.recordCacheMiss(isVoiceWorkflow);
            return null;
        }
        catch (error) {
            const err = error;
            this.logger.error(`Error getting webhook URL from cache for workflow ${workflowId}: ${err.message}`, err.stack);
            this.incrementFailureCount(workflowId);
            return null;
        }
    }
    async setWebhookUrl(workflowId, webhookUrl, isVoiceWorkflow = false) {
        try {
            const cached = {
                webhookUrl,
                workflowId,
                resolvedAt: Date.now(),
                isVoiceWorkflow,
            };
            await this.setInRedisCache(workflowId, cached, isVoiceWorkflow);
            if (isVoiceWorkflow) {
                this.setInMemoryCache(workflowId, cached);
            }
            this.logger.debug(`Webhook URL cached for workflow ${workflowId}`);
        }
        catch (error) {
            const err = error;
            this.logger.error(`Error setting webhook URL in cache for workflow ${workflowId}: ${err.message}`);
        }
    }
    async invalidate(workflowId) {
        try {
            this.memoryCache.delete(workflowId);
            this.cacheAccessTimes.delete(workflowId);
            await this.redisService.del(`${this.REDIS_KEY_PREFIX}${workflowId}`);
            await this.redisService.del(`${this.VOICE_REDIS_KEY_PREFIX}${workflowId}`);
            await this.redisService.del(`${this.VERSION_KEY_PREFIX}${workflowId}`);
            this.logger.log(`Cache invalidated for workflow ${workflowId}`);
        }
        catch (error) {
            const err = error;
            this.logger.error(`Error invalidating cache for workflow ${workflowId}: ${err.message}`);
        }
    }
    async refreshAndInvalidate(workflowId) {
        await this.invalidate(workflowId);
        this.logger.log(`Cache invalidated for workflow ${workflowId}, refresh needed`);
    }
    async prewarmCache(workflowId, webhookUrl) {
        try {
            this.logger.log(`Pre-warming cache for voice workflow ${workflowId}`);
            await this.setWebhookUrl(workflowId, webhookUrl, true);
        }
        catch (error) {
            const err = error;
            this.logger.error(`Error pre-warming cache for workflow ${workflowId}: ${err.message}`);
        }
    }
    shouldTriggerCircuitBreaker(workflowId) {
        const failures = this.failureCount.get(workflowId) || 0;
        const lastFailure = this.failureTimestamps.get(workflowId) || 0;
        if (Date.now() - lastFailure > this.circuitBreakerResetTime) {
            this.failureCount.delete(workflowId);
            this.failureTimestamps.delete(workflowId);
            return false;
        }
        return failures >= this.circuitBreakerThreshold;
    }
    resetCircuitBreaker(workflowId) {
        this.failureCount.delete(workflowId);
        this.failureTimestamps.delete(workflowId);
    }
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
    getFromMemoryCache(workflowId) {
        const cached = this.memoryCache.get(workflowId);
        if (!cached) {
            return null;
        }
        const age = Date.now() - cached.resolvedAt;
        if (age > this.memoryCacheTTL) {
            this.memoryCache.delete(workflowId);
            this.cacheAccessTimes.delete(workflowId);
            return null;
        }
        this.cacheAccessTimes.set(workflowId, Date.now());
        return cached;
    }
    setInMemoryCache(workflowId, cached) {
        if (this.memoryCache.size >= this.maxMemoryCacheSize) {
            this.evictLRU();
        }
        this.memoryCache.set(workflowId, cached);
        this.cacheAccessTimes.set(workflowId, Date.now());
    }
    evictLRU() {
        let oldestKey = null;
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
    async getFromRedisCache(workflowId, isVoiceWorkflow) {
        try {
            const prefix = isVoiceWorkflow ? this.VOICE_REDIS_KEY_PREFIX : this.REDIS_KEY_PREFIX;
            const key = `${prefix}${workflowId}`;
            const cached = await this.redisService.get(key);
            if (!cached) {
                return null;
            }
            const parsed = JSON.parse(cached);
            const ttl = isVoiceWorkflow ? this.voiceRedisCacheTTL : this.nonVoiceRedisCacheTTL;
            await this.redisService.set(key, cached, ttl);
            return parsed;
        }
        catch (error) {
            const err = error;
            this.logger.error(`Error getting from Redis cache for workflow ${workflowId}: ${err.message}`);
            return null;
        }
    }
    async setInRedisCache(workflowId, cached, isVoiceWorkflow) {
        try {
            const prefix = isVoiceWorkflow ? this.VOICE_REDIS_KEY_PREFIX : this.REDIS_KEY_PREFIX;
            const key = `${prefix}${workflowId}`;
            const baseTtl = isVoiceWorkflow ? this.voiceRedisCacheTTL : this.nonVoiceRedisCacheTTL;
            const jitter = Math.floor(baseTtl * 0.1 * (Math.random() * 2 - 1));
            const ttl = baseTtl + jitter;
            await this.redisService.set(key, JSON.stringify(cached), ttl);
        }
        catch (error) {
            const err = error;
            this.logger.error(`Error setting Redis cache for workflow ${workflowId}: ${err.message}`);
        }
    }
    recordCacheHit(layer, isVoice, latencyMs) {
        this.cacheHits++;
        if (isVoice) {
            this.voiceCacheHits++;
        }
        if (layer === 'memory') {
            this.memoryHits++;
        }
        else {
            this.redisHits++;
        }
        if (isVoice && latencyMs > 10) {
            this.logger.warn(`Voice workflow cache hit latency exceeded threshold: ${latencyMs}ms (target < 10ms)`);
        }
    }
    recordCacheMiss(isVoice) {
        this.cacheMisses++;
        if (isVoice) {
            this.voiceCacheMisses++;
        }
    }
    incrementFailureCount(workflowId) {
        const current = this.failureCount.get(workflowId) || 0;
        this.failureCount.set(workflowId, current + 1);
        this.failureTimestamps.set(workflowId, Date.now());
    }
    startCacheCleanup() {
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
        }, 60 * 1000);
    }
    startMetricsLogging() {
        setInterval(() => {
            const metrics = this.getMetrics();
            this.logger.log(`Cache Metrics: ${JSON.stringify(metrics)}`);
        }, 5 * 60 * 1000);
    }
    async setConnectionContext(connectionId, context) {
        try {
            const key = `${this.CONNECTION_KEY_PREFIX}${connectionId}`;
            const indexKey = `${this.CONNECTION_INDEX_PREFIX}${context.workflowId}:${context.sessionId}`;
            await this.redisService.set(key, JSON.stringify(context), this.connectionContextTTL);
            await this.redisService.set(indexKey, connectionId, this.connectionContextTTL);
            this.logger.debug(`Connection context stored for ${connectionId}`);
        }
        catch (error) {
            const err = error;
            this.logger.error(`Error storing connection context for ${connectionId}: ${err.message}`);
        }
    }
    async getConnectionContext(connectionId) {
        try {
            const key = `${this.CONNECTION_KEY_PREFIX}${connectionId}`;
            const cached = await this.redisService.get(key);
            if (!cached) {
                return null;
            }
            return JSON.parse(cached);
        }
        catch (error) {
            const err = error;
            this.logger.error(`Error getting connection context for ${connectionId}: ${err.message}`);
            return null;
        }
    }
    async getConnectionContextBySession(workflowId, sessionId) {
        try {
            const indexKey = `${this.CONNECTION_INDEX_PREFIX}${workflowId}:${sessionId}`;
            const connectionId = await this.redisService.get(indexKey);
            if (!connectionId) {
                return null;
            }
            return this.getConnectionContext(connectionId);
        }
        catch (error) {
            const err = error;
            this.logger.error(`Error getting connection context for workflow ${workflowId}, session ${sessionId}: ${err.message}`);
            return null;
        }
    }
    async updateConnectionHeartbeat(connectionId) {
        try {
            const context = await this.getConnectionContext(connectionId);
            if (!context) {
                this.logger.warn(`Connection context not found for heartbeat update: ${connectionId}`);
                return;
            }
            context.lastHeartbeat = Date.now();
            await this.setConnectionContext(connectionId, context);
            this.logger.debug(`Heartbeat updated for connection ${connectionId}`);
        }
        catch (error) {
            const err = error;
            this.logger.error(`Error updating heartbeat for ${connectionId}: ${err.message}`);
        }
    }
    async removeConnectionContext(connectionId) {
        try {
            const context = await this.getConnectionContext(connectionId);
            if (context) {
                const indexKey = `${this.CONNECTION_INDEX_PREFIX}${context.workflowId}:${context.sessionId}`;
                await this.redisService.del(indexKey);
            }
            const key = `${this.CONNECTION_KEY_PREFIX}${connectionId}`;
            await this.redisService.del(key);
            this.logger.log(`Connection context removed for ${connectionId}`);
        }
        catch (error) {
            const err = error;
            this.logger.error(`Error removing connection context for ${connectionId}: ${err.message}`);
        }
    }
    async isConnectionActive(connectionId, maxIdleMs = 30000) {
        try {
            const context = await this.getConnectionContext(connectionId);
            if (!context) {
                return false;
            }
            const idleTime = Date.now() - context.lastHeartbeat;
            return idleTime < maxIdleMs && context.isActive;
        }
        catch (error) {
            const err = error;
            this.logger.error(`Error checking connection status for ${connectionId}: ${err.message}`);
            return false;
        }
    }
};
exports.WebhookCacheService = WebhookCacheService;
exports.WebhookCacheService = WebhookCacheService = WebhookCacheService_1 = tslib_1.__decorate([
    (0, common_1.Injectable)(),
    tslib_1.__param(0, (0, common_1.Inject)(exports.REDIS_SERVICE_TOKEN)),
    tslib_1.__metadata("design:paramtypes", [Object])
], WebhookCacheService);
//# sourceMappingURL=webhook-cache.service.js.map