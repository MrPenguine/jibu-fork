import { OnModuleInit } from '@nestjs/common';
export interface CachedWebhookUrl {
    webhookUrl: string;
    workflowId: string;
    resolvedAt: number;
    isVoiceWorkflow?: boolean;
}
export interface IRedisService {
    get(key: string): Promise<string | null>;
    set(key: string, value: string, expirySeconds?: number): Promise<boolean>;
    del(key: string): Promise<boolean>;
    exists(key: string): Promise<boolean>;
}
export declare const REDIS_SERVICE_TOKEN = "REDIS_SERVICE";
export declare class WebhookCacheService implements OnModuleInit {
    private readonly redisService;
    private readonly logger;
    private readonly memoryCache;
    private readonly memoryCacheTTL;
    private readonly maxMemoryCacheSize;
    private readonly cacheAccessTimes;
    private readonly voiceRedisCacheTTL;
    private readonly nonVoiceRedisCacheTTL;
    private readonly connectionContextTTL;
    private readonly REDIS_KEY_PREFIX;
    private readonly VOICE_REDIS_KEY_PREFIX;
    private readonly VERSION_KEY_PREFIX;
    private readonly CONNECTION_KEY_PREFIX;
    private readonly CONNECTION_INDEX_PREFIX;
    private readonly failureCount;
    private readonly circuitBreakerThreshold;
    private readonly circuitBreakerResetTime;
    private readonly failureTimestamps;
    private cacheHits;
    private cacheMisses;
    private voiceCacheHits;
    private voiceCacheMisses;
    private memoryHits;
    private redisHits;
    constructor(redisService: IRedisService);
    onModuleInit(): void;
    getWebhookUrl(workflowId: string, isVoiceWorkflow?: boolean): Promise<string | null>;
    setWebhookUrl(workflowId: string, webhookUrl: string, isVoiceWorkflow?: boolean): Promise<void>;
    invalidate(workflowId: string): Promise<void>;
    refreshAndInvalidate(workflowId: string): Promise<void>;
    prewarmCache(workflowId: string, webhookUrl: string): Promise<void>;
    shouldTriggerCircuitBreaker(workflowId: string): boolean;
    resetCircuitBreaker(workflowId: string): void;
    getMetrics(): {
        totalHits: number;
        totalMisses: number;
        totalRequests: number;
        hitRate: string;
        voiceHits: number;
        voiceMisses: number;
        voiceHitRate: string;
        memoryHits: number;
        redisHits: number;
        memoryCacheSize: number;
    };
    private getFromMemoryCache;
    private setInMemoryCache;
    private evictLRU;
    private getFromRedisCache;
    private setInRedisCache;
    private recordCacheHit;
    private recordCacheMiss;
    private incrementFailureCount;
    private startCacheCleanup;
    private startMetricsLogging;
    setConnectionContext(connectionId: string, context: any): Promise<void>;
    getConnectionContext(connectionId: string): Promise<any | null>;
    getConnectionContextBySession(workflowId: string, sessionId: string): Promise<any | null>;
    updateConnectionHeartbeat(connectionId: string): Promise<void>;
    removeConnectionContext(connectionId: string): Promise<void>;
    isConnectionActive(connectionId: string, maxIdleMs?: number): Promise<boolean>;
}
