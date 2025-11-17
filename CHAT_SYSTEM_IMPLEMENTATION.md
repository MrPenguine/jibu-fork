# Chat System Implementation - Phase 4

## Overview

High-performance chat system with Redis-based caching for conversation history, context management, and real-time message delivery. Integrates seamlessly with existing webhook-only architecture.

## Architecture

### Redis Data Structure Design

```
chat:conversation:{sessionId}     → JSON with conversation metadata (24h TTL)
chat:messages:{sessionId}          → ZSET with timestamp scores (24h TTL)
chat:active:sessions               → SET of active sessionIds
chat:user:sessions:{userId}        → SET of sessionIds per user (24h TTL)
```

### TTL Configuration

- **Conversation TTL**: 86400 seconds (24 hours)
- **Message TTL**: 86400 seconds (24 hours)
- **Inactive Timeout**: 3600000 ms (1 hour)
- **Cleanup Interval**: 1800000 ms (30 minutes)

## Components

### Core Services

#### 1. ChatService (`apps/backend/src/core/chat/chat.service.ts`)

**Responsibilities:**
- Create conversations with proper TTL
- Add messages to sorted sets with chronological ordering
- Retrieve conversation history with limit parameter
- Get conversation context with complete AI context structure
- Integrate with existing MessageQueueService for webhook delivery

**Key Methods:**
```typescript
createConversation(sessionId, options)
addMessage(sessionId, options)
getConversation(sessionId)
getHistory(sessionId, options)
getConversationContext(sessionId, lastMessageText?)
updateStatus(sessionId, status)
deleteConversation(sessionId)
getActiveSessions()
getUserSessions(userId)
```

#### 2. ChatCleanupService (`apps/backend/src/core/chat/cleanup.service.ts`)

**Responsibilities:**
- Cron job every 30 minutes to cleanup inactive sessions
- Remove conversations inactive for more than 1 hour
- Clean up user sessions mapping and conversation data

**Key Methods:**
```typescript
@Cron(CronExpression.EVERY_30_MINUTES)
cleanupInactiveSessions()
triggerCleanup()  // Manual trigger
getCleanupStats()
```

### REST API Endpoints

#### 1. Start Conversation
```http
POST /api/v1/chat/start
Content-Type: application/json

{
  "sessionId": "session_123abc",
  "workflowId": "cf769a32-2140-420f-99ed-19abb22ee721",
  "workspaceId": "85fb8ec7-e33c-43ce-bc20-7fa0ac55060b",
  "userId": "user_456def",
  "initialContext": {
    "systemPrompt": "You are a helpful assistant",
    "systemMessage": "Welcome!"
  },
  "metadata": {
    "source": "web",
    "language": "en"
  }
}
```

**Response:**
```json
{
  "sessionId": "session_123abc",
  "workflowId": "cf769a32-2140-420f-99ed-19abb22ee721",
  "workspaceId": "85fb8ec7-e33c-43ce-bc20-7fa0ac55060b",
  "participants": [
    {
      "userId": "user_456def",
      "role": "user",
      "joinedAt": 1700000000000
    },
    {
      "role": "agent",
      "joinedAt": 1700000000000
    }
  ],
  "status": "active",
  "createdAt": 1700000000000,
  "lastActivity": 1700000000000,
  "context": {
    "systemPrompt": "You are a helpful assistant",
    "systemMessage": "Welcome!"
  },
  "metadata": {
    "source": "web",
    "language": "en"
  }
}
```

#### 2. Send Message
```http
POST /api/v1/chat/message
Content-Type: application/json

{
  "sessionId": "session_123abc",
  "text": "Hello, I need help with my order",
  "isVoice": false
}
```

**Voice Message Example:**
```json
{
  "sessionId": "session_123abc",
  "text": "Hello from voice",
  "isVoice": true,
  "voiceMetadata": {
    "confidence": 0.95,
    "language": "en-US",
    "duration": 3500
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": {
    "role": "user",
    "content": "Hello, I need help with my order",
    "timestamp": 1700000000000,
    "isVoice": false
  }
}
```

#### 3. Get Conversation History
```http
GET /api/v1/chat/history/:sessionId?limit=50&offset=0&includeSystem=false
```

**Response:**
```json
{
  "sessionId": "session_123abc",
  "messages": [
    {
      "role": "user",
      "content": "Hello",
      "timestamp": 1700000000000,
      "isVoice": false
    },
    {
      "role": "assistant",
      "content": "Hi there!",
      "timestamp": 1700000001000,
      "isVoice": false
    }
  ]
}
```

#### 4. Get Conversation Details
```http
GET /api/v1/chat/conversation/:sessionId
```

**Response:**
```json
{
  "sessionId": "session_123abc",
  "workflowId": "cf769a32-2140-420f-99ed-19abb22ee721",
  "workspaceId": "85fb8ec7-e33c-43ce-bc20-7fa0ac55060b",
  "participants": [...],
  "status": "active",
  "createdAt": 1700000000000,
  "lastActivity": 1700000005000,
  "context": {...},
  "metadata": {...}
}
```

## Webhook Integration

The chat system integrates with the existing `MessageQueueService` to deliver messages to n8n workflows. When a message is sent:

1. Message is added to conversation history in Redis
2. Complete conversation context is retrieved (system prompt, history, RAG context)
3. Context is passed to `MessageQueueService.sendMessageToWorkflow()` or `sendVoiceMessageToWorkflow()`
4. Message is enqueued for webhook delivery with full context

### Webhook Payload Structure

```typescript
{
  eventType: 'message',
  sessionId: 'session_123abc',
  workflowId: 'cf769a32-2140-420f-99ed-19abb22ee721',
  timestamp: 1700000000000,
  text: 'Hello, I need help',
  isVoice: false,
  aiContext: {
    systemPrompt: 'You are a helpful assistant',
    systemMessage: 'Welcome!',
    conversationHistory: [
      {
        role: 'user',
        content: 'Hello',
        timestamp: 1700000000000
      },
      {
        role: 'assistant',
        content: 'Hi there!',
        timestamp: 1700000001000
      }
    ],
    ragContext: {
      results: [],
      query: '',
      fallbackMessage: "I'm having trouble accessing that information right now."
    }
  }
}
```

## Testing

### Unit Tests

- **ChatService Tests**: `apps/backend/src/core/chat/__tests__/chat.service.spec.ts`
  - Conversation creation with TTL
  - Message storage in sorted sets
  - History retrieval with filters
  - Context building with RAG integration
  - Session management

- **ChatCleanupService Tests**: `apps/backend/src/core/chat/__tests__/cleanup.service.spec.ts`
  - Inactive session cleanup
  - Concurrent cleanup prevention
  - Error handling
  - Statistics reporting

### Integration Tests

- **Chat Integration Tests**: `apps/backend/src/modules/chat/__tests__/chat.integration.spec.ts`
  - Complete conversation flow
  - Webhook delivery verification
  - Context propagation
  - Error scenarios

### Running Tests

```bash
# Run all tests
pnpm test

# Run chat tests only
pnpm test chat

# Run with coverage
pnpm test:cov

# Watch mode
pnpm test:watch
```

## Configuration

### Environment Variables

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

### Module Registration

The chat module is registered in `app.module.ts`:

```typescript
import { ChatModule } from './modules/chat/chat.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RedisModule,
    V1Module,
    ChatModule,  // ← Chat module
  ],
})
export class AppModule {}
```

## Performance Characteristics

### Latency Targets

- **Conversation Creation**: < 100ms
- **Message Addition**: < 50ms
- **History Retrieval**: < 100ms
- **Context Building**: < 150ms
- **Webhook Enqueuing**: < 100ms (chat), < 50ms (voice)

### Scalability

- **Concurrent Conversations**: Millions (Redis clustering)
- **Messages per Conversation**: Unlimited (ZSET with TTL)
- **History Retrieval**: O(log N + M) where M is limit
- **Cleanup Performance**: Processes 1000+ sessions in < 30s

### Memory Management

- **Automatic TTL**: 24 hours for conversations and messages
- **Inactive Cleanup**: 1 hour inactivity threshold
- **Periodic Cleanup**: Every 30 minutes via cron

## Monitoring

### Metrics to Track

1. **Conversation Metrics**
   - Active conversations count
   - Conversation creation rate
   - Average conversation duration

2. **Message Metrics**
   - Messages per second
   - Average messages per conversation
   - Voice vs text message ratio

3. **Cleanup Metrics**
   - Cleanup duration
   - Sessions cleaned per run
   - Error rate during cleanup

4. **Performance Metrics**
   - API endpoint latency
   - Redis operation latency
   - Webhook delivery latency

### Health Checks

```typescript
// Get cleanup statistics
GET /api/v1/chat/cleanup/stats

// Trigger manual cleanup
POST /api/v1/chat/cleanup/trigger
```

## Deployment Checklist

- [ ] Redis is running and accessible
- [ ] Environment variables configured
- [ ] ChatModule imported in AppModule
- [ ] Cron jobs enabled (ScheduleModule)
- [ ] Tests passing
- [ ] Monitoring configured
- [ ] Webhook URLs configured in workflows

## Example Usage

### Complete Chat Flow

```typescript
// 1. Start conversation
const conversation = await fetch('http://localhost:3000/api/v1/chat/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: 'session_123',
    workflowId: 'cf769a32-2140-420f-99ed-19abb22ee721',
    workspaceId: '85fb8ec7-e33c-43ce-bc20-7fa0ac55060b',
    initialContext: {
      systemPrompt: 'You are a customer service agent',
      systemMessage: 'How can I help you today?'
    }
  })
});

// 2. Send message
const message = await fetch('http://localhost:3000/api/v1/chat/message', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: 'session_123',
    text: 'I need help with my order'
  })
});

// 3. Get history
const history = await fetch('http://localhost:3000/api/v1/chat/history/session_123?limit=10');
```

## Troubleshooting

### Common Issues

1. **Redis Connection Errors**
   - Verify Redis is running: `redis-cli ping`
   - Check environment variables
   - Verify network connectivity

2. **Messages Not Appearing in History**
   - Check TTL hasn't expired
   - Verify ZADD operations succeeded
   - Check Redis logs

3. **Cleanup Not Running**
   - Verify ScheduleModule is imported
   - Check cron expression syntax
   - Review application logs

4. **High Memory Usage**
   - Verify TTL is set correctly
   - Check cleanup service is running
   - Monitor active sessions count

## Future Enhancements

1. **RAG Integration**: Replace placeholder with actual RAG implementation
2. **Message Streaming**: Support streaming responses from AI
3. **Multi-tenancy**: Isolate conversations by organization
4. **Analytics**: Track conversation metrics and insights
5. **Message Reactions**: Support emoji reactions and feedback
6. **File Attachments**: Support file uploads in conversations
7. **Conversation Export**: Export conversation history to various formats

## References

- [Redis Sorted Sets](https://redis.io/docs/data-types/sorted-sets/)
- [NestJS Cron Jobs](https://docs.nestjs.com/techniques/task-scheduling)
- [Bull Queue](https://docs.nestjs.com/techniques/queues)
- [Webhook Integration Guide](./WEBHOOK_INTEGRATION_TEST_GUIDE.md)
