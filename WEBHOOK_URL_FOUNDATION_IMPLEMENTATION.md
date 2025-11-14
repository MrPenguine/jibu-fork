# Webhook URL Foundation - Implementation Guide

## Overview

This document describes the implementation of the Webhook URL Foundation system for managing webhook URLs with three-layer caching, optimized for voice applications.

## Architecture

### Component Separation

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
├─────────────────────┬───────────────────────────────────────┤
│   Backend Service   │        Worker Service                  │
│  (Control Plane)    │       (Data Plane)                     │
├─────────────────────┴───────────────────────────────────────┤
│              Shared Library (Cross-Cutting)                  │
│                WebhookCacheService                           │
├──────────────────────────────────────────────────────────────┤
│                   Infrastructure Layer                        │
│         Redis Cache    │    Database (Prisma)                │
└──────────────────────────────────────────────────────────────┘
```

### Key Components

1. **Shared Library** (`libs/cache-utils/`)
   - `WebhookCacheService`: Three-layer caching logic
   - Used by both backend and worker
   - Provides consistent caching behavior across services

2. **Backend Service** (`apps/backend/src/core/webhook/`)
   - `WebhookUrlService`: API-facing webhook URL operations
   - Handles refresh, retrieval, and validation
   - Integrates with shared cache service

3. **Worker Integration** (`apps/worker/src/n8n/`)
   - `PublishWorkflowProcessor`: Background job processing
   - Cache invalidation on workflow publish
   - Voice workflow detection and optimization

## Implementation Details

### 1. Shared Cache Service

**Location**: `libs/cache-utils/src/webhook-cache.service.ts`

**Key Features**:
- Three-layer caching (Memory → Redis → Database)
- Voice-specific optimizations
- Circuit breaker pattern
- Metrics tracking
- LRU eviction for memory cache

**Methods**:
```typescript
// Get webhook URL from cache (returns null if not cached)
getWebhookUrl(workflowId: string, isVoiceWorkflow: boolean): Promise<string | null>

// Set webhook URL in cache
setWebhookUrl(workflowId: string, webhookUrl: string, isVoiceWorkflow: boolean): Promise<void>

// Invalidate cache for a workflow
invalidate(workflowId: string): Promise<void>

// Invalidate and signal refresh needed
refreshAndInvalidate(workflowId: string): Promise<void>

// Pre-warm cache for voice workflows
prewarmCache(workflowId: string, webhookUrl: string): Promise<void>

// Circuit breaker management
shouldTriggerCircuitBreaker(workflowId: string): boolean
resetCircuitBreaker(workflowId: string): void

// Get cache metrics
getMetrics(): object
```

### 2. Backend Webhook URL Service

**Location**: `apps/backend/src/core/webhook/webhook-url.service.ts`

**Key Features**:
- Webhook URL refresh from n8n
- Integration with shared cache
- Voice workflow detection
- Latency monitoring

**Methods**:
```typescript
// Get webhook URL with caching (primary method)
getWebhookUrl(workflowId: string, isVoiceWorkflow: boolean): Promise<string | null>

// Refresh webhook URL from n8n
refreshWebhookUrl(workflowId: string): Promise<string | null>

// Get webhook URL directly from database (bypass cache)
getWebhookUrlDirect(workflowId: string): Promise<string | null>

// Batch refresh multiple workflows
batchRefreshWebhookUrls(workflowIds: string[]): Promise<Map<string, string | null>>

// Check if refresh is needed
needsRefresh(workflowId: string, maxAgeMinutes: number): Promise<boolean>

// Resolve base URL from environment
resolveBaseUrl(): string
```

### 3. Worker Integration

**Location**: `apps/worker/src/n8n/publish-workflow.processor.ts`

**Integration Points**:
1. After successful workflow publish
2. Cache invalidation with voice detection
3. 100ms delay for voice workflows (n8n propagation)
4. Fresh data population in cache

**Code Flow**:
```typescript
// Step 8: After workflow publish
await this.webhookCache.invalidate(workflowId);

if (webhookUrl) {
  const isVoiceWorkflow = await this.isVoiceWorkflow(workflowId);
  
  if (isVoiceWorkflow) {
    await this.delay(100); // n8n propagation delay
  }
  
  await this.webhookCache.setWebhookUrl(workflowId, webhookUrl, isVoiceWorkflow);
}
```

## Data Flow

### 1. Webhook URL Retrieval

```
User Request
    ↓
Backend Service
    ↓
WebhookUrlService.getWebhookUrl()
    ↓
WebhookCacheService.getWebhookUrl()
    ↓
┌─────────────────────────────────┐
│ Layer 1: Memory Cache (Voice)  │ → Hit? Return URL
└─────────────────────────────────┘
    ↓ Miss
┌─────────────────────────────────┐
│ Layer 2: Redis Cache            │ → Hit? Return URL + Populate Memory
└─────────────────────────────────┘
    ↓ Miss
┌─────────────────────────────────┐
│ Layer 3: Database (Prisma)      │ → Query + Populate Caches
└─────────────────────────────────┘
    ↓
Return URL to User
```

### 2. Workflow Publish Flow

```
Workflow Publish Request
    ↓
Worker: PublishWorkflowProcessor
    ↓
1. Compile workflow JSON
2. Create/Update in n8n
3. Persist to database
4. Extract webhook URL
    ↓
5. Invalidate Cache
   WebhookCacheService.invalidate()
    ↓
6. Detect Voice Workflow
   isVoiceWorkflow()
    ↓
7. Add Delay (if voice)
   delay(100ms)
    ↓
8. Populate Cache
   WebhookCacheService.setWebhookUrl()
    ↓
Publish Complete
```

### 3. Cache Invalidation Triggers

| Trigger | Location | Action |
|---------|----------|--------|
| Workflow Publish | Worker | Invalidate + Refresh |
| 404 Error | Worker/Backend | refreshAndInvalidate() |
| Manual Refresh | Backend | refreshWebhookUrl() |
| Periodic Job | Worker | Batch refresh active workflows |

## Voice-Specific Optimizations

### 1. Separate Caching Strategy

- **Voice Workflows**: Memory + Redis (1-hour TTL)
- **Non-Voice Workflows**: Redis only (30-minute TTL)

### 2. Pre-warming

```typescript
// When activating a voice agent
await webhookCache.prewarmCache(workflowId, webhookUrl);
```

### 3. Latency Monitoring

| Operation | Target | Warning Threshold |
|-----------|--------|-------------------|
| Cache Hit | < 10ms | > 10ms |
| Cache Miss | < 300ms | > 300ms |
| Refresh | < 500ms | > 500ms |

### 4. Voice Detection

Workflows are considered voice-enabled if the agent has:
- `ttsProvider` configured (Text-to-Speech)
- `sttProvider` configured (Speech-to-Text)

```typescript
private async isVoiceWorkflow(workflowId: string): Promise<boolean> {
  const workflow = await this.prisma.workflow.findUnique({
    where: { id: workflowId },
    include: { 
      agent: {
        select: {
          ttsProvider: true,
          sttProvider: true,
        }
      }
    },
  });

  return !!(workflow?.agent?.ttsProvider || workflow?.agent?.sttProvider);
}
```

## Configuration

### Environment Variables

```bash
# n8n Configuration (priority order)
N8N_WEBHOOK_URL=https://n8n.example.com  # Highest priority
N8N_PUBLIC_URL=https://n8n.example.com   # Fallback
N8N_API_URL=https://n8n.example.com/api/v1  # Lowest priority (strips /api/v1)

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password
```

### Cache Configuration

```typescript
// In WebhookCacheService
private readonly memoryCacheTTL = 5 * 60 * 1000; // 5 minutes
private readonly maxMemoryCacheSize = 100;
private readonly voiceRedisCacheTTL = 60 * 60; // 1 hour
private readonly nonVoiceRedisCacheTTL = 30 * 60; // 30 minutes
private readonly circuitBreakerThreshold = 3;
private readonly circuitBreakerResetTime = 5 * 60 * 1000; // 5 minutes
```

## Module Setup

### Backend Module

```typescript
// apps/backend/src/core/webhook/webhook-url.module.ts
@Module({
  imports: [ConfigModule],
  providers: [
    WebhookUrlService,
    WebhookCacheService,
    PrismaService,
    RedisService,
  ],
  exports: [WebhookUrlService, WebhookCacheService],
})
export class WebhookUrlModule {}
```

### Worker Module

```typescript
// apps/worker/src/n8n/n8n.module.ts
@Module({
  imports: [DatabaseModule, HttpModule, ConfigModule],
  providers: [
    N8nIntegrationService,
    N8nWorkflowProcessor,
    N8nAdminClient,
    PublishWorkflowProcessor,
    WebhookCacheService,  // Added
    RedisService,          // Added
  ],
  exports: [N8nIntegrationService, N8nAdminClient, WebhookCacheService],
})
export class N8nModule {}
```

## Monitoring & Metrics

### Cache Metrics

The service logs metrics every 5 minutes:

```json
{
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

### Key Metrics to Monitor

1. **Cache Hit Rate**: Should be > 95% for active workflows
2. **Voice Hit Rate**: Should be > 97% for voice workflows
3. **Memory Cache Size**: Should stay under 100 entries
4. **Latency**: Voice operations should meet thresholds
5. **Circuit Breaker Triggers**: Should be rare

### Logging

All services use NestJS Logger with structured logging:

```typescript
this.logger.log(`Webhook URL refreshed for workflow ${workflowId} in ${duration}ms`);
this.logger.warn(`Voice workflow cache hit exceeded latency threshold: ${duration}ms`);
this.logger.error(`Failed to refresh webhook URL: ${error.message}`, error.stack);
```

## Testing Strategy

### Unit Tests

1. **WebhookCacheService**
   - Cache hit/miss scenarios
   - LRU eviction
   - Circuit breaker logic
   - Metrics tracking

2. **WebhookUrlService**
   - URL refresh logic
   - Cache integration
   - Voice detection
   - Error handling

3. **PublishWorkflowProcessor**
   - Cache invalidation
   - Voice workflow handling
   - Integration with cache service

### Integration Tests

1. **End-to-End Flow**
   - Publish workflow → Cache invalidation → Fresh data
   - Get webhook URL → Cache layers → Database fallback
   - 404 error → Refresh and invalidate

2. **Performance Tests**
   - Cache hit latency < 10ms for voice
   - Cache miss latency < 300ms for voice
   - Refresh latency < 500ms for voice

### Load Tests

1. **Concurrent Requests**
   - 1000 concurrent webhook URL requests
   - Cache stampede protection
   - Redis connection pooling

2. **Cache Eviction**
   - Fill memory cache to limit
   - Verify LRU eviction
   - Check performance impact

## Validation Steps

### 1. Cache Hit Rate

```bash
# Monitor logs for cache metrics
# Target: > 95% for active voice workflows
```

### 2. Workflow Publish

```bash
# Publish a workflow
# Check logs for cache invalidation
# Verify fresh data in cache
```

### 3. 404 Error Handling

```bash
# Simulate 404 error
# Verify refreshAndInvalidate() is called
# Check circuit breaker triggers after 3 failures
```

### 4. Voice Workflow Detection

```bash
# Create voice-enabled agent
# Publish workflow
# Verify voice-specific caching (memory + Redis)
# Check 100ms delay in logs
```

### 5. Latency Monitoring

```bash
# Monitor logs for latency warnings
# Voice cache hit should be < 10ms
# Voice cache miss should be < 300ms
# Voice refresh should be < 500ms
```

## Troubleshooting

### Issue: High Cache Miss Rate

**Symptoms**: Cache hit rate < 90%

**Possible Causes**:
1. Frequent workflow publishes (invalidating cache)
2. Redis connectivity issues
3. TTL too short for usage pattern

**Solutions**:
1. Check publish frequency in logs
2. Verify Redis connection and health
3. Consider increasing TTL for stable workflows

### Issue: Memory Cache Not Working

**Symptoms**: All cache hits from Redis, none from memory

**Possible Causes**:
1. `isVoiceWorkflow` flag not set correctly
2. Memory cache full and evicting entries
3. TTL too short

**Solutions**:
1. Verify voice detection logic
2. Check memory cache size in metrics
3. Increase memory cache size if needed

### Issue: Circuit Breaker Triggering

**Symptoms**: Repeated circuit breaker warnings in logs

**Possible Causes**:
1. Database connectivity issues
2. n8n service unhealthy
3. Webhook URLs not being updated

**Solutions**:
1. Check database connection
2. Verify n8n service status
3. Check workflow publish logs
4. Manually refresh affected workflows

### Issue: High Latency for Voice Workflows

**Symptoms**: Latency warnings in logs

**Possible Causes**:
1. Redis slow or overloaded
2. Database queries slow
3. Network latency

**Solutions**:
1. Check Redis performance metrics
2. Optimize database queries
3. Consider Redis clustering
4. Increase memory cache size

## Future Enhancements

### 1. Periodic Refresh Job

Create a scheduled job to refresh active voice workflows:

```typescript
@Cron('*/30 * * * *') // Every 30 minutes
async refreshActiveVoiceWorkflows() {
  const activeWorkflows = await this.getActiveVoiceWorkflows();
  await this.webhookUrlService.batchRefreshWebhookUrls(activeWorkflows);
}
```

### 2. Fallback Message System

Implement voice-safe fallback messages on cache/refresh failure:

```typescript
if (!webhookUrl && isVoiceWorkflow) {
  return this.getFallbackMessage();
}
```

### 3. Advanced Metrics

- Prometheus metrics export
- Grafana dashboards
- Alerting on low hit rates
- Latency percentiles (p95, p99)

### 4. Cache Versioning

Implement cache versioning using workflow hash:

```typescript
const version = this.computeWorkflowHash(workflowJson);
await this.redis.set(`webhook:version:${workflowId}`, version);
```

### 5. Distributed Locking

Add Redis locks during refresh operations:

```typescript
const lock = await this.redis.lock(`refresh:${workflowId}`, 5000);
try {
  await this.refreshWebhookUrl(workflowId);
} finally {
  await lock.release();
}
```

## Summary

The Webhook URL Foundation provides:

✅ **Three-layer caching** for optimal performance
✅ **Voice-specific optimizations** for low-latency requirements
✅ **Shared library architecture** for consistency across services
✅ **Circuit breaker pattern** for resilience
✅ **Comprehensive monitoring** and metrics
✅ **Automatic cache invalidation** on workflow publish
✅ **Graceful fallback** to database when caches miss

This implementation ensures reliable and fast webhook URL management for both voice and non-voice applications, with strict latency requirements met for voice workflows.
