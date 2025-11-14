# Webhook Queue Infrastructure - Integration Guide

## Quick Start

This guide shows you how to integrate the webhook queue infrastructure into your application.

---

## Backend Integration

### Step 1: Import the Services Module

Add `ServicesModule` to your application module:

```typescript
// apps/backend/src/app.module.ts
import { Module } from '@nestjs/common';
import { ServicesModule } from './core/services/services.module';
import { QueueModule } from './core/queue/queue.module';

@Module({
  imports: [
    QueueModule,        // Required for queue infrastructure
    ServicesModule,     // Provides MessageQueueService and ConnectionService
    // ... other modules
  ],
})
export class AppModule {}
```

### Step 2: Inject Services in Your Controllers/Services

```typescript
// Example: Chat message controller
import { Controller, Post, Body } from '@nestjs/common';
import { MessageQueueService } from './core/services/message-queue.service';
import { ConnectionService } from './core/services/connection.service';

@Controller('chat')
export class ChatController {
  constructor(
    private readonly messageQueue: MessageQueueService,
    private readonly connectionService: ConnectionService,
  ) {}

  @Post('message')
  async sendMessage(@Body() dto: SendMessageDto) {
    // For regular chat messages
    await this.messageQueue.sendMessageToWorkflow(
      dto.workflowId,
      dto.sessionId,
      {
        type: 'user_message',
        text: dto.text,
        timestamp: Date.now(),
      }
    );

    return { status: 'queued' };
  }
}
```

### Step 3: Voice Call Integration

```typescript
// Example: Voice call controller
import { Controller, Post, Body } from '@nestjs/common';
import { MessageQueueService } from './core/services/message-queue.service';
import { ConnectionService } from './core/services/connection.service';

@Controller('voice')
export class VoiceController {
  constructor(
    private readonly messageQueue: MessageQueueService,
    private readonly connectionService: ConnectionService,
  ) {}

  @Post('call/start')
  async startCall(@Body() dto: StartCallDto) {
    // Create connection context for the call
    const connectionId = await this.connectionService.createConnection(
      dto.workflowId,
      dto.sessionId,
      dto.callSid,
      {
        agentName: dto.agentName,
        phoneNumber: dto.phoneNumber,
      }
    );

    return { connectionId };
  }

  @Post('call/message')
  async sendVoiceMessage(@Body() dto: VoiceMessageDto) {
    // Send voice event with high priority
    await this.messageQueue.sendCallEventToWorkflow(
      dto.workflowId,
      dto.sessionId,
      {
        type: 'speech_input',
        text: dto.transcription,
        confidence: dto.confidence,
        timestamp: Date.now(),
      },
      dto.connectionId,
      true // high priority
    );

    return { status: 'queued' };
  }

  @Post('call/heartbeat')
  async updateHeartbeat(@Body() dto: HeartbeatDto) {
    // Update connection heartbeat (call every 15 seconds)
    await this.connectionService.updateHeartbeat(dto.connectionId);
    return { status: 'ok' };
  }

  @Post('call/end')
  async endCall(@Body() dto: EndCallDto) {
    // End the connection
    await this.connectionService.endConnection(dto.connectionId);
    return { status: 'ended' };
  }
}
```

---

## Worker Integration

The worker is already configured! The `WebhookDeliveryProcessor` will automatically:
1. Pick up jobs from the `WEBHOOK_DELIVERY` queue
2. Retrieve webhook URLs from cache
3. Deliver payloads to n8n webhooks
4. Handle failures with circuit breaker and fallback messages

No additional integration needed on the worker side.

---

## Frontend Integration (Optional)

### WebSocket Integration for Real-Time Updates

```typescript
// Example: React component with WebSocket
import { useEffect, useState } from 'react';
import io from 'socket.io-client';

function VoiceCallComponent({ workflowId, sessionId }) {
  const [connectionId, setConnectionId] = useState(null);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Connect to WebSocket
    const ws = io('http://localhost:3000');
    setSocket(ws);

    // Start call
    fetch('/api/voice/call/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflowId, sessionId }),
    })
      .then(res => res.json())
      .then(data => setConnectionId(data.connectionId));

    return () => ws.close();
  }, []);

  useEffect(() => {
    if (!connectionId) return;

    // Send heartbeat every 15 seconds
    const interval = setInterval(() => {
      fetch('/api/voice/call/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId }),
      });
    }, 15000);

    return () => clearInterval(interval);
  }, [connectionId]);

  const sendMessage = async (text) => {
    await fetch('/api/voice/call/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workflowId,
        sessionId,
        connectionId,
        transcription: text,
        confidence: 0.95,
      }),
    });
  };

  const endCall = async () => {
    await fetch('/api/voice/call/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionId }),
    });
  };

  return (
    <div>
      <button onClick={() => sendMessage('Hello')}>Send Message</button>
      <button onClick={endCall}>End Call</button>
    </div>
  );
}
```

---

## Testing Your Integration

### 1. Test Non-Voice Message

```bash
curl -X POST http://localhost:3000/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{
    "workflowId": "workflow-123",
    "sessionId": "session-456",
    "text": "Hello, world!"
  }'
```

### 2. Test Voice Call Flow

```bash
# Start call
curl -X POST http://localhost:3000/api/voice/call/start \
  -H "Content-Type: application/json" \
  -d '{
    "workflowId": "workflow-123",
    "sessionId": "session-456",
    "callSid": "CA123456",
    "agentName": "Support Agent"
  }'

# Send voice message (use connectionId from previous response)
curl -X POST http://localhost:3000/api/voice/call/message \
  -H "Content-Type: application/json" \
  -d '{
    "workflowId": "workflow-123",
    "sessionId": "session-456",
    "connectionId": "conn_workflow-123_session-456_1699876543210_abc123",
    "transcription": "I need help",
    "confidence": 0.95
  }'

# Update heartbeat
curl -X POST http://localhost:3000/api/voice/call/heartbeat \
  -H "Content-Type: application/json" \
  -d '{
    "connectionId": "conn_workflow-123_session-456_1699876543210_abc123"
  }'

# End call
curl -X POST http://localhost:3000/api/voice/call/end \
  -H "Content-Type: application/json" \
  -d '{
    "connectionId": "conn_workflow-123_session-456_1699876543210_abc123"
  }'
```

### 3. Monitor Queue Status

```bash
# Check queue health
curl http://localhost:3000/api/queue/webhook/health

# Check queue stats
curl http://localhost:3000/api/queue/webhook/stats
```

---

## Monitoring Integration

### Add Queue Health Endpoint

```typescript
// apps/backend/src/core/queue/queue-health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { MessageQueueService } from '../services/message-queue.service';

@Controller('queue/webhook')
export class WebhookQueueHealthController {
  constructor(private readonly messageQueue: MessageQueueService) {}

  @Get('health')
  async getHealth() {
    return this.messageQueue.getQueueHealth();
  }

  @Get('stats')
  async getStats() {
    return this.messageQueue.getQueueStats();
  }
}
```

### Add Prometheus Metrics (Optional)

```typescript
// Install: npm install @willsoto/nestjs-prometheus prom-client

import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { makeCounterProvider, makeGaugeProvider } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [
    PrometheusModule.register(),
  ],
  providers: [
    makeCounterProvider({
      name: 'webhook_delivery_total',
      help: 'Total webhook deliveries',
      labelNames: ['status', 'is_voice'],
    }),
    makeGaugeProvider({
      name: 'webhook_queue_length',
      help: 'Current webhook queue length',
    }),
  ],
})
export class MetricsModule {}
```

---

## Environment Configuration

Add these to your `.env` file:

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

# Queue Settings (optional overrides)
WEBHOOK_QUEUE_ATTEMPTS=2
WEBHOOK_QUEUE_TIMEOUT=5000
WEBHOOK_QUEUE_RATE_LIMIT=15
```

---

## Troubleshooting

### Issue: Jobs not being processed

**Check:**
1. Worker is running: `ps aux | grep worker`
2. Queue is registered: Check logs for "WebhookDeliveryProcessor initialized"
3. Redis is accessible: `redis-cli ping`

**Solution:**
```bash
# Restart worker
npm run start:worker

# Check Redis connection
redis-cli -h localhost -p 6379 ping
```

### Issue: High latency for voice workflows

**Check:**
1. Cache hit rate: Should be >97% for voice
2. Webhook response time: Should be <500ms
3. Queue depth: Should be <50 waiting jobs

**Solution:**
```typescript
// Pre-warm cache on workflow activation
await webhookCacheService.prewarmCache(workflowId, webhookUrl);

// Increase workers if queue is backing up
// Set ENABLE_WORKER_SCALING=true in .env
```

### Issue: Circuit breaker triggering frequently

**Check:**
1. n8n instance health
2. Webhook URL configuration
3. Network connectivity

**Solution:**
```bash
# Check n8n health
curl https://n8n.example.com/healthz

# Verify webhook URL in cache
redis-cli GET "voice:webhook:url:workflow-123"

# Reset circuit breaker
redis-cli DEL "webhook:failures:workflow-123"
```

---

## Best Practices

### 1. Always Use Connection Context for Voice Calls

```typescript
// ✅ Good
const connectionId = await connectionService.createConnection(...);
await messageQueue.sendCallEventToWorkflow(..., connectionId, true);

// ❌ Bad - no connection tracking
await messageQueue.sendCallEventToWorkflow(..., null, true);
```

### 2. Update Heartbeat Regularly

```typescript
// ✅ Good - update every 15 seconds
setInterval(() => {
  connectionService.updateHeartbeat(connectionId);
}, 15000);

// ❌ Bad - no heartbeat updates
// Connection will timeout after 5 minutes
```

### 3. Handle Fallback Messages Gracefully

```typescript
// ✅ Good - check for fallback in response
const result = await messageQueue.sendCallEventToWorkflow(...);
if (result?.fallback) {
  // Play fallback message to user
  playAudio(result.message);
}

// ❌ Bad - ignore fallback
// User experiences dead air
```

### 4. Pre-warm Cache on Workflow Activation

```typescript
// ✅ Good - pre-warm when workflow is activated
await webhookCacheService.prewarmCache(workflowId, webhookUrl);

// ❌ Bad - let first request populate cache
// First voice call will have higher latency
```

### 5. Monitor Queue Health

```typescript
// ✅ Good - regular health checks
setInterval(async () => {
  const health = await messageQueue.getQueueHealth();
  if (!health.healthy) {
    logger.error('Queue unhealthy:', health.reason);
    // Alert ops team
  }
}, 60000);

// ❌ Bad - no monitoring
// Issues go unnoticed
```

---

## Migration from Existing System

If you're migrating from a synchronous webhook delivery system:

### Step 1: Add Queue Infrastructure

```typescript
// Old synchronous approach
async sendToWorkflow(workflowId: string, payload: any) {
  const webhookUrl = await this.getWebhookUrl(workflowId);
  return axios.post(webhookUrl, payload);
}

// New queue-based approach
async sendToWorkflow(workflowId: string, payload: any) {
  await this.messageQueue.sendMessageToWorkflow(
    workflowId,
    sessionId,
    payload
  );
  return { status: 'queued' };
}
```

### Step 2: Update Voice Call Handling

```typescript
// Old approach - blocking
async handleVoiceInput(input: string) {
  const response = await this.sendToWorkflow(workflowId, { text: input });
  return response.data;
}

// New approach - non-blocking with fallback
async handleVoiceInput(input: string, connectionId: string) {
  await this.messageQueue.sendCallEventToWorkflow(
    workflowId,
    sessionId,
    { text: input },
    connectionId,
    true
  );
  
  // Return immediately, actual response comes via callback
  return { status: 'processing' };
}
```

### Step 3: Gradual Rollout

1. Deploy queue infrastructure alongside existing system
2. Route 10% of traffic to new system
3. Monitor metrics (latency, error rate, fallback rate)
4. Gradually increase traffic to 100%
5. Remove old synchronous system

---

## Support

For questions or issues:
- Check the main documentation: `WEBHOOK_QUEUE_IMPLEMENTATION.md`
- Review logs in `apps/backend/logs` and `apps/worker/logs`
- Contact the development team

---

**Last Updated**: 2025-11-13
**Version**: 1.0.0
