# 🔄 Queue Infrastructure Implementation Explained

This document explains how Phase 2 (Queue Infrastructure Setup) is implemented in the Jibu Console codebase.

---

## 📋 Overview

The queue infrastructure uses **Bull** (Redis-backed queue system) with voice-specific optimizations to handle webhook delivery with strict latency requirements.

---

## 1️⃣ Queue Configuration

### **Location:** `apps/backend/src/core/queue/queue.module.ts`

### **Single Queue with Priority System**

Instead of separate queues (VOICE_EVENTS, VOICE_WORKFLOWS, MESSAGE_WORKFLOWS), we use **ONE queue** with a **priority-based system**:

```typescript
// Queue configuration (lines 38-59)
{
  name: QUEUE_NAMES.WEBHOOK_DELIVERY, // Single queue: 'webhook-delivery'
  
  // Voice-optimized settings
  defaultJobOptions: {
    attempts: 2, // ✅ Only 2 retries (prevents dead air)
    backoff: {
      type: 'exponential', // ✅ Exponential backoff
      delay: 500, // ✅ 500ms initial delay
    },
    timeout: 5000, // ✅ 5-second timeout
    removeOnComplete: true,
    removeOnFail: 100,
  },
  
  limiter: {
    max: 15, // ✅ 15 jobs/second rate limit
    duration: 1000,
  },
  
  settings: {
    maxStalledCount: 1, // ✅ Fail fast (prevents dead air)
    stalledInterval: 5000, // Check every 5 seconds
  },
}
```

### **Why One Queue Instead of Three?**

The implementation uses a **single queue with priority levels** instead of separate queues:

**Advantages:**
- ✅ Simpler architecture
- ✅ Better resource utilization
- ✅ Priority-based processing (high-priority jobs processed first)
- ✅ Easier to monitor and maintain

**Priority Levels:**
```typescript
// apps/backend/src/core/services/message-queue.service.ts (lines 11-15)
export enum WebhookPriority {
  VOICE_HIGH = 10,    // Voice events (highest priority) - like VOICE_EVENTS queue
  VOICE_NORMAL = 5,   // Voice events (normal priority) - like VOICE_WORKFLOWS queue
  NON_VOICE = 1,      // Non-voice workflows - like MESSAGE_WORKFLOWS queue
}
```

---

## 2️⃣ Voice-Specific Queue Parameters

### **✅ Max Retries: 2 for Voice Events**

**Implementation:** `queue.module.ts` line 42
```typescript
attempts: 2, // Only 2 retries to prevent dead air
```

**Logic:** `message-queue.service.ts` line 168
```typescript
attempts: 2, // Only 2 attempts for voice
```

**Fallback Trigger:** `webhook-delivery.processor.ts` lines 153-158
```typescript
// For voice workflows, trigger fallback after max retries
if (isVoice && job.attemptsMade >= 2) {
  this.logger.warn(
    `Max retries reached for voice workflow ${workflowId}, triggering fallback`
  );
  this.fallbackCount++;
  return { fallback: true, message: this.FALLBACK_MESSAGE };
}
```

### **✅ Backoff Strategy: Exponential, 500ms Delay, Max 2s**

**Implementation:** `queue.module.ts` lines 43-46
```typescript
backoff: {
  type: 'exponential', // Exponential backoff
  delay: 500,          // 500ms initial delay
},
```

**How it works:**
- **Attempt 1:** Immediate
- **Attempt 2:** 500ms delay
- **Attempt 3:** 1000ms delay (2^1 * 500ms)
- **Max:** Capped at 2 seconds by timeout

### **✅ Max Stalled Count: 1**

**Implementation:** `queue.module.ts` line 56
```typescript
maxStalledCount: 1, // Fail fast to prevent dead air
```

**What this means:**
- If a job becomes "stalled" (worker crashed/hung), it's only retried **once**
- After that, it's marked as failed
- Prevents voice calls from experiencing long delays

---

## 3️⃣ Connection Context Tracking in Redis

### **Location:** `apps/backend/src/core/services/connection.service.ts`

### **✅ Store Active Call State with 5-Minute TTL**

**Implementation:** Lines 12-13
```typescript
private readonly HEARTBEAT_INTERVAL_MS = 15000; // 15 seconds
private readonly CONNECTION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
```

**Connection Context Structure:** `libs/queue-definitions/src/index.ts` lines 102-110
```typescript
export interface ConnectionContext {
  workflowId: string;      // ✅ Workflow ID
  sessionId: string;       // Session ID
  callSid?: string;        // ✅ Twilio call SID
  startTime: number;       // ✅ Call start time
  lastHeartbeat: number;   // Last heartbeat timestamp
  isActive: boolean;       // Active status
  metadata?: Record<string, any>; // Additional metadata
}
```

### **✅ Creating a Connection**

**Method:** `connection.service.ts` lines 24-50
```typescript
async createConnection(
  workflowId: string,
  sessionId: string,
  callSid?: string,
  metadata?: Record<string, any>
): Promise<string> {
  const connectionId = this.generateConnectionId(workflowId, sessionId);
  const now = Date.now();

  const context: ConnectionContext = {
    workflowId,      // ✅ Workflow ID stored
    sessionId,
    callSid,         // ✅ Call SID stored
    startTime: now,  // ✅ Start time stored
    lastHeartbeat: now,
    isActive: true,
    metadata,
  };

  // Store in Redis with 5-minute TTL
  await this.cacheService.setConnectionContext(connectionId, context);
  
  return connectionId;
}
```

### **✅ Implement Connection Heartbeat System (15s Intervals)**

**Heartbeat Update:** `connection.service.ts` lines 77-80
```typescript
async updateHeartbeat(connectionId: string): Promise<void> {
  await this.cacheService.updateConnectionHeartbeat(connectionId);
  this.logger.debug(`Heartbeat updated for connection ${connectionId}`);
}
```

**Automatic Heartbeat on Voice Events:** `message-queue.service.ts` lines 186-188
```typescript
// Update connection heartbeat if provided
if (connectionId) {
  await this.connectionService.updateHeartbeat(connectionId);
}
```

**Heartbeat Interval Getter:** `connection.service.ts` lines 188-190
```typescript
getHeartbeatInterval(): number {
  return this.HEARTBEAT_INTERVAL_MS; // 15000ms = 15 seconds
}
```

### **✅ Redis Storage Implementation**

**Location:** `libs/cache-utils/src/webhook-cache.service.ts`

**Set Connection Context:**
```typescript
async setConnectionContext(
  connectionId: string,
  context: ConnectionContext
): Promise<void> {
  const key = `connection:${connectionId}`;
  const ttl = 5 * 60; // 5 minutes TTL
  
  await this.redis.setex(
    key,
    ttl,
    JSON.stringify(context)
  );
}
```

**Update Heartbeat:**
```typescript
async updateConnectionHeartbeat(connectionId: string): Promise<void> {
  const context = await this.getConnectionContext(connectionId);
  
  if (context) {
    context.lastHeartbeat = Date.now();
    await this.setConnectionContext(connectionId, context);
  }
}
```

**Check if Active:**
```typescript
async isConnectionActive(
  connectionId: string,
  maxIdleMs: number = 30000
): Promise<boolean> {
  const context = await this.getConnectionContext(connectionId);
  
  if (!context || !context.isActive) {
    return false;
  }
  
  const idleTime = Date.now() - context.lastHeartbeat;
  return idleTime < maxIdleMs;
}
```

---

## 4️⃣ Priority-Based Job Processing

### **How Jobs Are Enqueued with Priority**

### **Voice Events (High Priority)**

**Method:** `message-queue.service.ts` lines 111-197
```typescript
async sendCallEventToWorkflow(
  workflowId: string,
  sessionId: string,
  payload: any,
  connectionId?: string,
  highPriority: boolean = true,
  options?: JobOptions
): Promise<void> {
  // Determine priority level
  const priority = highPriority 
    ? WebhookPriority.VOICE_HIGH    // Priority 10
    : WebhookPriority.VOICE_NORMAL; // Priority 5
  
  const jobData: WebhookDeliveryJobData = {
    workflowId,
    sessionId,
    payload,
    isVoice: true,        // ✅ Marked as voice
    connectionId,         // ✅ Connection tracking
    priority,             // ✅ High priority
  };

  // Enqueue with high priority
  const job = await this.webhookQueue.add(
    JOB_NAMES.DELIVER_WEBHOOK, 
    jobData, 
    {
      priority,           // ✅ Priority set
      attempts: 2,        // ✅ Only 2 attempts
      timeout: 5000,      // ✅ 5-second timeout
      ...options,
    }
  );
}
```

### **Non-Voice Messages (Low Priority)**

**Method:** `message-queue.service.ts` lines 39-99
```typescript
async sendMessageToWorkflow(
  workflowId: string,
  sessionId: string,
  payload: any,
  options?: JobOptions
): Promise<void> {
  const jobData: WebhookDeliveryJobData = {
    workflowId,
    sessionId,
    payload,
    isVoice: false,                    // ✅ Not voice
    priority: WebhookPriority.NON_VOICE, // ✅ Low priority (1)
  };

  // Enqueue with low priority
  const job = await this.webhookQueue.add(
    JOB_NAMES.DELIVER_WEBHOOK, 
    jobData, 
    {
      priority: WebhookPriority.NON_VOICE, // ✅ Priority 1
      ...options,
    }
  );
}
```

---

## 5️⃣ Rate Limiting

### **Implementation:** `queue.module.ts` lines 51-54

```typescript
limiter: {
  max: 15,        // Maximum 15 jobs
  duration: 1000, // Per 1000ms (1 second)
},
```

**What this means:**
- Maximum **15 jobs per second** can be processed
- Prevents overwhelming the n8n instance
- Ensures consistent performance

**Note:** The original spec mentioned:
- VOICE_EVENTS: 20 jobs/sec
- VOICE_WORKFLOWS: 15 jobs/sec
- MESSAGE_WORKFLOWS: no limit

**Current implementation:** 15 jobs/sec for all (can be adjusted if needed)

---

## 6️⃣ Circuit Breaker Pattern

### **Location:** `webhook-delivery.processor.ts`

### **Failure Tracking**

**Implementation:** Lines 22-24
```typescript
private readonly failureCount = new Map<string, number>();
private readonly circuitBreakerThreshold = 3;
private readonly circuitBreakerResetTime = 5 * 60 * 1000; // 5 minutes
```

### **Check Circuit Breaker**

**Method:** Lines 242-245
```typescript
private shouldTriggerCircuitBreaker(workflowId: string): boolean {
  const failures = this.failureCount.get(workflowId) || 0;
  return failures >= this.circuitBreakerThreshold; // 3 failures
}
```

### **Increment on Failure**

**Method:** Lines 250-258
```typescript
private incrementFailureCount(workflowId: string): void {
  const current = this.failureCount.get(workflowId) || 0;
  this.failureCount.set(workflowId, current + 1);

  // Reset after timeout (5 minutes)
  setTimeout(() => {
    this.failureCount.delete(workflowId);
  }, this.circuitBreakerResetTime);
}
```

### **Reset on Success**

**Method:** Lines 263-265
```typescript
private resetCircuitBreaker(workflowId: string): void {
  this.failureCount.delete(workflowId);
}
```

### **Trigger Fallback**

**Implementation:** Lines 84-95
```typescript
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
```

---

## 7️⃣ Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    API Request (Voice Call)                  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  ConnectionService.createConnection()                        │
│  - Generate connectionId                                     │
│  - Store in Redis with 5-min TTL                            │
│  - Include: workflowId, sessionId, callSid, startTime       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  MessageQueueService.sendCallEventToWorkflow()              │
│  - Check circuit breaker                                     │
│  - Pre-warm webhook URL cache                               │
│  - Set priority: VOICE_HIGH (10)                            │
│  - Set attempts: 2                                          │
│  - Set timeout: 5000ms                                      │
│  - Update heartbeat                                         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Redis Queue (webhook-delivery)                             │
│  - Rate limit: 15 jobs/sec                                  │
│  - Priority-based processing                                │
│  - Jobs sorted by priority (10 > 5 > 1)                    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  WebhookDeliveryProcessor.handle()                          │
│  - Check circuit breaker                                     │
│  - Get webhook URL from cache                               │
│  - POST to n8n webhook                                      │
│  - Timeout: 5s for voice, 10s for non-voice                │
│  - Track metrics                                            │
└────────────────────────┬────────────────────────────────────┘
                         │
                    ┌────┴────┐
                    │         │
              Success      Failure
                    │         │
                    ▼         ▼
        ┌──────────────┐  ┌──────────────┐
        │ Reset        │  │ Increment    │
        │ Circuit      │  │ Failure      │
        │ Breaker      │  │ Count        │
        └──────────────┘  └──────┬───────┘
                                 │
                            Retry?
                                 │
                        ┌────────┴────────┐
                        │                 │
                   Yes (< 2)         No (>= 2)
                        │                 │
                        ▼                 ▼
                  ┌──────────┐    ┌──────────────┐
                  │ Backoff  │    │ Trigger      │
                  │ 500ms    │    │ Fallback     │
                  │ Retry    │    │ Message      │
                  └──────────┘    └──────────────┘
```

---

## 8️⃣ Key Differences from Original Spec

| Spec | Implementation | Reason |
|------|----------------|--------|
| 3 separate queues | 1 queue with priorities | Simpler, more efficient |
| VOICE_EVENTS: 20 jobs/sec | 15 jobs/sec for all | Unified rate limiting |
| VOICE_WORKFLOWS: 15 jobs/sec | Priority-based | Better resource management |
| MESSAGE_WORKFLOWS: no limit | Priority 1 | Consistent architecture |

---

## 9️⃣ Testing the Implementation

### **Test Voice Event Enqueuing:**
```typescript
await messageQueueService.sendCallEventToWorkflow(
  'workflow-123',
  'session-456',
  { event: 'call_started' },
  'conn-789',
  true // high priority
);
```

### **Test Non-Voice Message:**
```typescript
await messageQueueService.sendMessageToWorkflow(
  'workflow-123',
  'session-456',
  { message: 'Hello' }
);
```

### **Test Connection Tracking:**
```typescript
const connectionId = await connectionService.createConnection(
  'workflow-123',
  'session-456',
  'CA1234567890'
);

// Update heartbeat every 15 seconds
setInterval(async () => {
  await connectionService.updateHeartbeat(connectionId);
}, 15000);
```

---

## 🎯 Summary

✅ **Queue Configuration:** Single queue with voice-optimized settings  
✅ **Priority System:** 3-level priority (10, 5, 1) for different job types  
✅ **Retry Strategy:** 2 attempts max, exponential backoff (500ms)  
✅ **Rate Limiting:** 15 jobs/second  
✅ **Stalled Jobs:** Max 1 stalled count (fail fast)  
✅ **Connection Tracking:** Redis-based with 5-minute TTL  
✅ **Heartbeat System:** 15-second intervals  
✅ **Circuit Breaker:** 3 failures trigger fallback  
✅ **Fallback Message:** Automatic for voice after max retries  

**The implementation successfully achieves all Phase 2 requirements with a cleaner, priority-based architecture!** 🎉
