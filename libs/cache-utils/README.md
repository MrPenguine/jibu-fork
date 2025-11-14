# Cache Utils Library

Shared caching utilities for webhook URL management across backend and worker services.

## Overview

This library provides a three-layer caching system optimized for voice applications with strict latency requirements:

1. **In-Memory Cache** (Layer 1): 5-minute TTL, 100 entry limit with LRU eviction
2. **Redis Cache** (Layer 2): 1-hour TTL with auto-renew
3. **Database** (Layer 3): Source of truth

## Architecture

```
┌─────────────┐         ┌─────────────┐
│   Backend   │         │   Worker    │
│   Service   │         │  Processor  │
└──────┬──────┘         └──────┬──────┘
       │                       │
       └───────┬───────────────┘
               │
               ▼
    ┌──────────────────────┐
    │ WebhookCacheService  │
    │  (Shared Library)    │
    └──────────┬───────────┘
               │
       ┌───────┴────────┐
       │                │
       ▼                ▼
┌─────────────┐  ┌─────────────┐
│   Memory    │  │    Redis    │
│   Cache     │  │    Cache    │
└─────────────┘  └─────────────┘
       │                │
       └────────┬───────┘
                ▼
         ┌─────────────┐
         │  Database   │
         │ (Prisma)    │
         └─────────────┘
```

## Features

### Three-Layer Caching
- **Memory Cache**: Fastest access for active voice workflows (< 10ms target)
- **Redis Cache**: Distributed cache with auto-renewal and stampede protection
- **Database Fallback**: Authoritative source when caches miss

### Voice-Specific Optimizations
- Separate Redis namespaces for voice vs non-voice workflows
- Higher TTL for voice workflows (1 hour vs 30 minutes)
- Pre-warming support for active voice agents
- LRU eviction policy for memory cache

### Circuit Breaker Pattern
- Tracks failure counts per workflow
- Triggers refresh after threshold (3 failures)
- Auto-resets after 5 minutes

### Metrics & Monitoring
- Cache hit/miss rates (overall and voice-specific)
- Layer-specific hit rates (memory vs Redis)
- Latency tracking with voice threshold warnings
- Periodic metrics logging (every 5 minutes)

## Usage

### Installation

The library is automatically available via the TypeScript path alias:

```typescript
import { WebhookCacheService } from '@jibu/cache-utils';
```

### Basic Usage

```typescript
import { WebhookCacheService } from '@jibu/cache-utils';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class YourService {
  constructor(
    private readonly webhookCache: WebhookCacheService,
    private readonly redis: RedisService,
  ) {}

  async getWebhookUrl(workflowId: string, isVoice: boolean = false) {
    // Try to get from cache
    let url = await this.webhookCache.getWebhookUrl(workflowId, isVoice);
    
    if (!url) {
      // Cache miss - query database
      url = await this.queryDatabase(workflowId);
      
      if (url) {
        // Populate cache
        await this.webhookCache.setWebhookUrl(workflowId, url, isVoice);
      }
    }
    
    return url;
  }
}
```

### Cache Invalidation

```typescript
// After workflow publish
await this.webhookCache.invalidate(workflowId);

// After 404 error - invalidate and signal refresh needed
await this.webhookCache.refreshAndInvalidate(workflowId);
```

### Pre-warming for Voice Workflows

```typescript
// When activating a voice agent
await this.webhookCache.prewarmCache(workflowId, webhookUrl);
```

### Circuit Breaker

```typescript
// Check if circuit breaker should trigger
if (this.webhookCache.shouldTriggerCircuitBreaker(workflowId)) {
  // Handle circuit breaker - trigger refresh or fallback
}

// Reset circuit breaker after successful operation
this.webhookCache.resetCircuitBreaker(workflowId);
```

### Metrics

```typescript
// Get cache metrics
const metrics = this.webhookCache.getMetrics();
console.log(metrics);
// {
//   totalHits: 1250,
//   totalMisses: 50,
//   totalRequests: 1300,
//   hitRate: '96.15%',
//   voiceHits: 800,
//   voiceMisses: 20,
//   voiceHitRate: '97.56%',
//   memoryHits: 750,
//   redisHits: 500,
//   memoryCacheSize: 45
// }
```

## Configuration

### Redis Service Interface

The `WebhookCacheService` depends on an `IRedisService` interface:

```typescript
export interface IRedisService {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, expirySeconds?: number): Promise<boolean>;
  del(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
}
```

Ensure your Redis service implements this interface.

### Cache TTLs

Default TTLs can be customized by modifying the service:

- **Memory Cache TTL**: 5 minutes (300,000 ms)
- **Voice Redis TTL**: 1 hour (3,600 seconds)
- **Non-Voice Redis TTL**: 30 minutes (1,800 seconds)

### Cache Limits

- **Max Memory Cache Size**: 100 entries
- **Circuit Breaker Threshold**: 3 failures
- **Circuit Breaker Reset Time**: 5 minutes

## Voice-Specific Latency Thresholds

| Operation | Target | Warning Threshold |
|-----------|--------|-------------------|
| Cache Hit (Voice) | < 10ms | > 10ms |
| Cache Miss (Voice) | < 300ms | > 300ms |
| Refresh (Voice) | < 500ms | > 500ms |

## Integration Examples

### Backend Service

```typescript
import { Injectable } from '@nestjs/common';
import { WebhookCacheService } from '@jibu/cache-utils';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class WebhookUrlService {
  constructor(
    private readonly cache: WebhookCacheService,
    private readonly prisma: PrismaService,
  ) {}

  async getWebhookUrl(workflowId: string, isVoice: boolean) {
    // Try cache first
    let url = await this.cache.getWebhookUrl(workflowId, isVoice);
    
    if (!url) {
      // Query database
      const workflow = await this.prisma.workflow.findUnique({
        where: { id: workflowId },
        include: { n8nWorkflow: true },
      });
      
      url = workflow?.n8nWorkflow?.webhookUrl || null;
      
      if (url) {
        await this.cache.setWebhookUrl(workflowId, url, isVoice);
      }
    }
    
    return url;
  }
}
```

### Worker Processor

```typescript
import { Injectable } from '@nestjs/common';
import { WebhookCacheService } from '@jibu/cache-utils';

@Injectable()
export class PublishWorkflowProcessor {
  constructor(
    private readonly webhookCache: WebhookCacheService,
  ) {}

  async publishWorkflow(workflowId: string, webhookUrl: string) {
    // ... publish logic ...
    
    // Invalidate cache after publish
    await this.webhookCache.invalidate(workflowId);
    
    // Populate with fresh data
    const isVoice = await this.isVoiceWorkflow(workflowId);
    if (isVoice) {
      await this.delay(100); // n8n propagation delay
    }
    await this.webhookCache.setWebhookUrl(workflowId, webhookUrl, isVoice);
  }
}
```

## Testing

### Unit Tests

```typescript
describe('WebhookCacheService', () => {
  let service: WebhookCacheService;
  let mockRedis: jest.Mocked<IRedisService>;

  beforeEach(() => {
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
    };
    
    service = new WebhookCacheService(mockRedis);
  });

  it('should return null on cache miss', async () => {
    mockRedis.get.mockResolvedValue(null);
    const result = await service.getWebhookUrl('workflow-1');
    expect(result).toBeNull();
  });

  it('should return cached URL on hit', async () => {
    const cached = JSON.stringify({
      webhookUrl: 'https://n8n.example.com/webhook/test',
      workflowId: 'workflow-1',
      resolvedAt: Date.now(),
    });
    mockRedis.get.mockResolvedValue(cached);
    
    const result = await service.getWebhookUrl('workflow-1');
    expect(result).toBe('https://n8n.example.com/webhook/test');
  });
});
```

## Performance Considerations

1. **Memory Cache**: Limited to 100 entries to prevent memory bloat
2. **LRU Eviction**: Least recently used entries are evicted when cache is full
3. **Cache Stampede Protection**: Random jitter (±10%) added to Redis TTL
4. **Auto-Renewal**: Redis TTL is renewed on access to keep hot data cached
5. **Periodic Cleanup**: Expired memory cache entries cleaned every minute

## Monitoring

The service logs metrics every 5 minutes:

```
Cache Metrics: {
  "totalHits": 1250,
  "totalMisses": 50,
  "totalRequests": 1300,
  "hitRate": "96.15%",
  "voiceHits": 800,
  "voiceMisses": 20,
  "voiceHitRate": "97.56%",
  "memoryHits": 750,
  "redisHits": 500,
  "memoryCacheSize": 45
}
```

Monitor these metrics to ensure:
- Cache hit rate > 95% for active voice workflows
- Voice-specific hit rate > 97%
- Memory cache size stays under limit

## Troubleshooting

### High Cache Miss Rate

1. Check if workflows are being published frequently (invalidating cache)
2. Verify Redis is running and accessible
3. Check TTL settings - may need adjustment for your use case

### Memory Cache Not Working

1. Ensure `isVoiceWorkflow` flag is set to `true` for voice workflows
2. Check memory cache size - may be full and evicting entries
3. Verify LRU eviction is working correctly

### Circuit Breaker Triggering

1. Check for repeated failures in logs
2. Verify database connectivity
3. Ensure n8n service is healthy
4. Check if webhook URLs are being updated correctly

## License

Internal use only - Part of Jibu Console
