# Webhook Queue Infrastructure Implementation

## Overview

This document describes the implementation of Phase 2: Queue Infrastructure Setup for webhook delivery with voice-specific optimizations and autoscaling capabilities.

## Implementation Summary

### ✅ Completed Components

#### 1. Queue Definitions (`libs/queue-definitions/src/index.ts`)
- **Added WEBHOOK_DELIVERY queue** to `QUEUE_NAMES`
- **Added DELIVER_WEBHOOK job** to `JOB_NAMES`
- **Created interfaces:**
  - `WebhookDeliveryJobData` - Job payload for webhook delivery
  - `ConnectionContext` - Voice call connection state

#### 2. Cache Utilities Enhancement (`libs/cache-utils/src/webhook-cache.service.ts`)
- **Added connection context management methods:**
  - `setConnectionContext()` - Store active voice call context
  - `getConnectionContext()` - Retrieve connection by ID
  - `getConnectionContextBySession()` - Retrieve by workflow + session
  - `updateConnectionHeartbeat()` - Update connection heartbeat (15s intervals)
  - `removeConnectionContext()` - Clean up ended connections
  - `isConnectionActive()` - Check connection health
- **Voice-specific features:**
  - Separate Redis namespace: `voice:connection:*`
  - 5-minute TTL for active connections
  - Index mapping for fast lookups

#### 3. Backend Queue Configuration (`apps/backend/src/core/queue/queue.module.ts`)
- **Configured WEBHOOK_DELIVERY queue with voice-optimized settings:**
  - Max 2 retry attempts (prevents dead air)
  - Exponential backoff with 500ms delay
  - 5-second timeout for voice requirement
  - Rate limiting: 15 jobs/second
  - Max stalled count: 1 (fail fast)

#### 4. Connection Service (`apps/backend/src/core/services/connection.service.ts`)
- **Manages active voice call connections using Redis**
- **Key features:**
  - Create/retrieve/update/end connections
  - 15-second heartbeat interval
  - 5-minute connection timeout
  - Graceful termination support
  - Metadata tracking

#### 5. Message Queue Service (`apps/backend/src/core/services/message-queue.service.ts`)
- **Enqueues webhook delivery jobs with priority handling**
- **Two main methods:**
  - `sendMessageToWorkflow()` - For non-voice workflows
  - `sendCallEventToWorkflow()` - For voice workflows (high priority)
- **Voice-specific features:**
  - Priority levels (VOICE_HIGH=10, VOICE_NORMAL=5, NON_VOICE=1)
  - Circuit breaker integration
  - Pre-warming cache for voice workflows
  - Heartbeat updates on event delivery
  - Target latency: <50ms for voice, <100ms for non-voice

#### 6. Webhook Delivery Processor (`apps/worker/src/n8n/webhook-delivery.processor.ts`)
- **Processes webhook delivery jobs from the queue**
- **Key features:**
  - Retrieves webhook URL from cache
  - 5-second timeout for voice workflows
  - Circuit breaker pattern (3 failures = open)
  - Fallback message after 2 failed attempts
  - Comprehensive metrics tracking
- **Voice-specific handling:**
  - Fast failure to prevent dead air
  - Pre-configured fallback messages
  - Target delivery time: <500ms

#### 7. Scaling Service Enhancement (`apps/worker/src\scaling\scaling.service.ts`)
- **Enhanced to monitor both workflow and webhook queues**
- **Scaling triggers:**
  - Scale up: webhook queue > 50 waiting jobs OR total > threshold
  - Scale down: webhook queue < 20 AND total active < workers/2
- **Configuration:**
  - Min workers: 3
  - Max workers: 10
  - Monitoring interval: 30 seconds

#### 8. Module Registration
- **Created `ServicesModule`** for backend services
- **Updated `N8nModule`** to include WebhookDeliveryProcessor
- **Updated `ScalingModule`** to monitor webhook queue
- **Updated `QueueService`** with webhook queue methods

---

## Architecture

### Data Flow

```
User Message → Backend API
    ↓
MessageQueueService.sendCallEventToWorkflow()
    ↓
Validate connection context
    ↓
Pre-warm cache (voice workflows)
    ↓
Enqueue to WEBHOOK_DELIVERY queue (priority: 10)
    ↓
Worker picks up job
    ↓
WebhookDeliveryProcessor.handle()
    ↓
Retrieve webhook URL from cache
    ↓
Deliver to n8n webhook (5s timeout)
    ↓
n8n executes workflow
    ↓
Callback to backend
    ↓
Inject results into conversation
```

### Voice-Specific Optimizations

#### Dead Air Prevention
1. **Immediate acknowledgment** within 100ms
2. **Fast queuing** with no synchronous processing
3. **Priority handling** for voice events (priority 10 vs 1)
4. **Limited retries** (max 2) before fallback
5. **5-second timeout** on webhook delivery
6. **Pre-configured fallback** messages

#### Performance Targets
- Cache hit rate: >95% (>97% for voice)
- Average delivery time: <500ms
- Fallback rate: <3%
- Conversation abandonment: <5%

---

## Configuration

### Environment Variables

```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Worker Scaling
ENABLE_WORKER_SCALING=true
MIN_WORKERS=3
MAX_WORKERS=10
QUEUE_THRESHOLD=50

# n8n Configuration
N8N_WEBHOOK_URL=https://n8n.example.com
N8N_PUBLIC_URL=https://n8n.example.com
N8N_API_URL=https://n8n.example.com/api/v1
```

### Queue Settings

```typescript
// WEBHOOK_DELIVERY Queue
{
  attempts: 2,                    // Only 2 retries
  backoff: {
    type: 'exponential',
    delay: 500,                   // 500ms delay
  },
  timeout: 5000,                  // 5-second timeout
  limiter: {
    max: 15,                      // 15 jobs/second
    duration: 1000,
  },
  settings: {
    maxStalledCount: 1,           // Fail fast
    stalledInterval: 5000,
  },
}
```

---

## Usage Examples

### Backend: Sending a Voice Event

```typescript
import { MessageQueueService } from './core/services/message-queue.service';
import { ConnectionService } from './core/services/connection.service';

// Create connection for voice call
const connectionId = await connectionService.createConnection(
  workflowId,
  sessionId,
  callSid,
  { agentName: 'Customer Support' }
);

// Send voice event with high priority
await messageQueueService.sendCallEventToWorkflow(
  workflowId,
  sessionId,
  {
    type: 'user_message',
    text: 'Hello, I need help',
    timestamp: Date.now(),
  },
  connectionId,
  true // high priority
);

// Update heartbeat every 15 seconds
setInterval(async () => {
  await connectionService.updateHeartbeat(connectionId);
}, 15000);

// End connection when call completes
await connectionService.endConnection(connectionId);
```

### Backend: Sending a Non-Voice Message

```typescript
import { MessageQueueService } from './core/services/message-queue.service';

await messageQueueService.sendMessageToWorkflow(
  workflowId,
  sessionId,
  {
    type: 'user_message',
    text: 'Hello',
    timestamp: Date.now(),
  }
);
```

### Worker: Monitoring Queue Health

```typescript
import { MessageQueueService } from './core/services/message-queue.service';

const stats = await messageQueueService.getQueueStats();
console.log('Queue stats:', stats);
// { waiting: 10, active: 5, completed: 1000, failed: 2, delayed: 0, total: 15 }

const health = await messageQueueService.getQueueHealth();
console.log('Queue health:', health);
// { healthy: true }
```

---

## Monitoring & Metrics

### Key Metrics to Track

1. **Webhook Delivery Metrics**
   - Total deliveries
   - Average delivery time
   - Failure count
   - Fallback rate
   - P95/P99 latency

2. **Cache Metrics**
   - Cache hit rate (overall)
   - Voice cache hit rate
   - Memory cache hits
   - Redis cache hits

3. **Queue Metrics**
   - Waiting jobs
   - Active jobs
   - Failed jobs
   - Queue depth over time

4. **Connection Metrics**
   - Active connections
   - Connection duration
   - Heartbeat failures
   - Abandonment rate

### Logging

All components log comprehensive metrics:
- **WebhookDeliveryProcessor**: Logs metrics every 5 minutes
- **WebhookCacheService**: Logs cache metrics every 5 minutes
- **ScalingService**: Logs queue metrics every 30 seconds

---

## Error Handling

### Circuit Breaker Pattern

The system implements a circuit breaker to prevent cascading failures:

1. **Threshold**: 3 consecutive failures
2. **Reset time**: 5 minutes
3. **Behavior when open**:
   - Voice workflows: Return fallback message
   - Non-voice workflows: Reject with error

### Fallback Messages

For voice workflows, after 2 failed delivery attempts:
```
"I apologize, but I'm experiencing technical difficulties. Please try again."
```

### Retry Strategy

- **Voice workflows**: 2 attempts with 500ms exponential backoff
- **Non-voice workflows**: 3 attempts with 1000ms exponential backoff

---

## Testing

### Validation Steps

1. ✅ **Verify voice events are processed before non-voice events**
   - Send both types simultaneously
   - Confirm voice events complete first

2. ✅ **Confirm cache hit rate > 95% for active voice workflows**
   - Monitor cache metrics
   - Check voice-specific hit rate

3. ✅ **Test fallback message triggers after 2 failed attempts**
   - Simulate webhook failures
   - Verify fallback message returned

4. ✅ **Simulate high load and verify autoscaling works**
   - Enqueue 100+ jobs
   - Monitor worker scaling

5. ✅ **Monitor connection heartbeat system during active calls**
   - Create connection
   - Verify heartbeat updates every 15s

6. ✅ **Validate that dead air is prevented in all failure scenarios**
   - Test timeout scenarios
   - Test circuit breaker scenarios
   - Verify fallback messages

### Test Commands

```bash
# Run backend tests
cd apps/backend
npm test

# Run worker tests
cd apps/worker
npm test

# Run integration tests
npm run test:e2e
```

---

## Deployment

### Prerequisites

1. Redis instance running and accessible
2. n8n instance running with webhook support
3. Bull queue configured in both backend and worker

### Deployment Steps

1. **Deploy shared libraries**
   ```bash
   npm run build:libs
   ```

2. **Deploy backend**
   ```bash
   cd apps/backend
   npm run build
   npm run start:prod
   ```

3. **Deploy worker**
   ```bash
   cd apps/worker
   npm run build
   npm run start:prod
   ```

4. **Verify deployment**
   - Check queue registration
   - Verify processor registration
   - Monitor logs for errors

---

## Performance Optimization

### Voice Workflow Optimizations

1. **Pre-warming**: Cache webhook URLs before first use
2. **Priority queuing**: Voice events processed first
3. **Fast failure**: Fail within 5 seconds to prevent dead air
4. **Connection tracking**: Monitor active calls with heartbeats
5. **Fallback messages**: Immediate response on repeated failures

### Scaling Strategy

- **Vertical scaling**: Increase worker concurrency based on CPU
- **Horizontal scaling**: Add workers based on queue depth
- **Predictive scaling**: Scale up before expected traffic surges

---

## Troubleshooting

### Common Issues

#### 1. High Fallback Rate (>3%)

**Symptoms**: Many voice workflows returning fallback messages

**Possible causes**:
- n8n instance overloaded
- Network latency issues
- Webhook URL misconfiguration

**Solutions**:
- Check n8n instance health
- Verify webhook URLs in cache
- Review network connectivity
- Check circuit breaker status

#### 2. Low Cache Hit Rate (<95%)

**Symptoms**: Frequent database queries for webhook URLs

**Possible causes**:
- Cache not pre-warmed
- TTL too short
- Redis connection issues

**Solutions**:
- Implement pre-warming on workflow activation
- Increase cache TTL for voice workflows
- Check Redis connectivity
- Review cache eviction logs

#### 3. Queue Backlog

**Symptoms**: Many waiting jobs, slow processing

**Possible causes**:
- Insufficient workers
- Worker scaling disabled
- n8n webhook slow to respond

**Solutions**:
- Enable worker scaling
- Increase max workers
- Optimize n8n workflows
- Check webhook timeout settings

#### 4. Connection Abandonment (>5%)

**Symptoms**: Voice calls ending prematurely

**Possible causes**:
- Heartbeat not updating
- Connection timeout too short
- Network interruptions

**Solutions**:
- Verify heartbeat interval (15s)
- Increase connection timeout if needed
- Check network stability
- Review connection logs

---

## Future Enhancements

### Planned Improvements

1. **Advanced Scaling**
   - Predictive scaling based on historical patterns
   - Multi-region worker deployment
   - Dynamic queue priority adjustment

2. **Enhanced Monitoring**
   - Real-time dashboard for queue metrics
   - Alerting on threshold breaches
   - Distributed tracing integration

3. **Performance Optimization**
   - Batch webhook delivery for non-voice
   - Adaptive timeout based on workflow complexity
   - Smart cache pre-warming

4. **Reliability Improvements**
   - Multi-region Redis replication
   - Automatic failover for workers
   - Dead letter queue for failed jobs

---

## References

- [Bull Queue Documentation](https://github.com/OptimalBits/bull)
- [NestJS Bull Module](https://docs.nestjs.com/techniques/queues)
- [Redis Best Practices](https://redis.io/topics/best-practices)
- [Voice Application Latency Requirements](https://www.itu.int/rec/T-REC-G.114)

---

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review logs in `apps/backend/logs` and `apps/worker/logs`
3. Contact the development team

---

**Last Updated**: 2025-11-13
**Version**: 1.0.0
**Status**: ✅ Implementation Complete
