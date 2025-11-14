# Webhook Queue Infrastructure - Quick Reference

## 🚀 Quick Start

### Backend: Send a Message

```typescript
import { MessageQueueService } from './core/services/message-queue.service';

// Non-voice message
await messageQueue.sendMessageToWorkflow(workflowId, sessionId, payload);

// Voice message (high priority)
await messageQueue.sendCallEventToWorkflow(
  workflowId, 
  sessionId, 
  payload, 
  connectionId, 
  true
);
```

### Backend: Manage Voice Connections

```typescript
import { ConnectionService } from './core/services/connection.service';

// Start call
const connectionId = await connectionService.createConnection(
  workflowId, 
  sessionId, 
  callSid
);

// Update heartbeat (every 15s)
await connectionService.updateHeartbeat(connectionId);

// End call
await connectionService.endConnection(connectionId);
```

---

## 📊 Key Metrics

| Metric | Target | Check |
|--------|--------|-------|
| Cache Hit Rate | >95% | `cacheService.getMetrics()` |
| Voice Cache Hit Rate | >97% | `cacheService.getMetrics()` |
| Avg Delivery Time | <500ms | Processor logs |
| Fallback Rate | <3% | Processor logs |
| Queue Depth | <50 | `messageQueue.getQueueStats()` |

---

## 🔧 Configuration

### Environment Variables

```bash
# Required
REDIS_HOST=localhost
REDIS_PORT=6379
N8N_WEBHOOK_URL=https://n8n.example.com

# Optional
ENABLE_WORKER_SCALING=true
MIN_WORKERS=3
MAX_WORKERS=10
WEBHOOK_QUEUE_ATTEMPTS=2
WEBHOOK_QUEUE_TIMEOUT=5000
```

---

## 🎯 Priority Levels

```typescript
enum WebhookPriority {
  VOICE_HIGH = 10,      // Urgent voice events
  VOICE_NORMAL = 5,     // Normal voice events
  NON_VOICE = 1,        // Chat messages
}
```

---

## ⚡ Performance Targets

| Component | Target Latency |
|-----------|----------------|
| Enqueue (voice) | <50ms |
| Enqueue (non-voice) | <100ms |
| Cache hit | <10ms |
| Webhook delivery | <500ms |
| Total (voice) | <600ms |

---

## 🔄 Data Flow

```
User Input
  ↓
Backend API
  ↓
MessageQueueService (enqueue)
  ↓
WEBHOOK_DELIVERY Queue
  ↓
WebhookDeliveryProcessor (worker)
  ↓
n8n Webhook
  ↓
Workflow Execution
  ↓
Callback to Backend
```

---

## 🛡️ Error Handling

### Circuit Breaker
- **Threshold**: 3 consecutive failures
- **Reset**: 5 minutes
- **Voice behavior**: Return fallback message
- **Non-voice behavior**: Reject with error

### Retry Strategy
- **Voice**: 2 attempts, 500ms backoff
- **Non-voice**: 3 attempts, 1000ms backoff

### Fallback Message
```
"I apologize, but I'm experiencing technical difficulties. Please try again."
```

---

## 📈 Monitoring

### Check Queue Health

```typescript
const health = await messageQueue.getQueueHealth();
// { healthy: true }

const stats = await messageQueue.getQueueStats();
// { waiting: 10, active: 5, completed: 1000, failed: 2, delayed: 0 }
```

### Check Cache Metrics

```typescript
const metrics = cacheService.getMetrics();
// {
//   totalHits: 1000,
//   totalMisses: 50,
//   hitRate: "95.24%",
//   voiceHitRate: "97.50%",
//   memoryCacheSize: 45
// }
```

---

## 🐛 Troubleshooting

### High Fallback Rate

```bash
# Check n8n health
curl https://n8n.example.com/healthz

# Check webhook URL in cache
redis-cli GET "voice:webhook:url:workflow-123"

# Reset circuit breaker
redis-cli DEL "webhook:failures:workflow-123"
```

### Low Cache Hit Rate

```typescript
// Pre-warm cache on workflow activation
await cacheService.prewarmCache(workflowId, webhookUrl);

// Check cache TTL
redis-cli TTL "voice:webhook:url:workflow-123"
```

### Queue Backlog

```bash
# Check queue depth
curl http://localhost:3000/api/queue/webhook/stats

# Enable scaling
export ENABLE_WORKER_SCALING=true

# Increase max workers
export MAX_WORKERS=15
```

---

## 🧪 Testing Commands

### Test Non-Voice Message

```bash
curl -X POST http://localhost:3000/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{"workflowId":"wf-123","sessionId":"sess-456","text":"Hello"}'
```

### Test Voice Call

```bash
# Start
curl -X POST http://localhost:3000/api/voice/call/start \
  -H "Content-Type: application/json" \
  -d '{"workflowId":"wf-123","sessionId":"sess-456","callSid":"CA123"}'

# Send message
curl -X POST http://localhost:3000/api/voice/call/message \
  -H "Content-Type: application/json" \
  -d '{"workflowId":"wf-123","sessionId":"sess-456","connectionId":"conn_...","transcription":"Help"}'

# Heartbeat
curl -X POST http://localhost:3000/api/voice/call/heartbeat \
  -H "Content-Type: application/json" \
  -d '{"connectionId":"conn_..."}'

# End
curl -X POST http://localhost:3000/api/voice/call/end \
  -H "Content-Type: application/json" \
  -d '{"connectionId":"conn_..."}'
```

---

## 📦 Module Imports

### Backend

```typescript
import { ServicesModule } from './core/services/services.module';
import { QueueModule } from './core/queue/queue.module';

@Module({
  imports: [QueueModule, ServicesModule],
})
export class AppModule {}
```

### Worker

```typescript
// Already configured in N8nModule and ScalingModule
// No additional imports needed
```

---

## 🔑 Key Classes

### Backend

| Class | Purpose | Location |
|-------|---------|----------|
| `MessageQueueService` | Enqueue webhook jobs | `apps/backend/src/core/services/` |
| `ConnectionService` | Manage voice connections | `apps/backend/src/core/services/` |
| `WebhookCacheService` | Cache webhook URLs | `libs/cache-utils/src/` |

### Worker

| Class | Purpose | Location |
|-------|---------|----------|
| `WebhookDeliveryProcessor` | Process webhook jobs | `apps/worker/src/n8n/` |
| `ScalingService` | Autoscale workers | `apps/worker/src/scaling/` |

---

## 🎨 Best Practices

### ✅ DO

```typescript
// Pre-warm cache for voice workflows
await cacheService.prewarmCache(workflowId, webhookUrl);

// Use connection context for voice calls
const connectionId = await connectionService.createConnection(...);
await messageQueue.sendCallEventToWorkflow(..., connectionId, true);

// Update heartbeat every 15 seconds
setInterval(() => connectionService.updateHeartbeat(connectionId), 15000);

// Handle fallback messages
if (result?.fallback) {
  playAudio(result.message);
}
```

### ❌ DON'T

```typescript
// Don't skip connection tracking for voice
await messageQueue.sendCallEventToWorkflow(..., null, true); // ❌

// Don't forget heartbeat updates
// Connection will timeout after 5 minutes // ❌

// Don't ignore fallback messages
// User experiences dead air // ❌

// Don't skip cache pre-warming
// First call has higher latency // ❌
```

---

## 📞 Support

- **Documentation**: See `WEBHOOK_QUEUE_IMPLEMENTATION.md`
- **Integration**: See `INTEGRATION_GUIDE.md`
- **Summary**: See `PHASE_2_COMPLETION_SUMMARY.md`
- **Logs**: `apps/backend/logs` and `apps/worker/logs`

---

## 🔗 Useful Links

- [Bull Queue Docs](https://github.com/OptimalBits/bull)
- [NestJS Bull Module](https://docs.nestjs.com/techniques/queues)
- [Redis Best Practices](https://redis.io/topics/best-practices)

---

**Version**: 1.0.0
**Last Updated**: 2025-11-13
