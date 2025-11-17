# Chat System Quick Start Guide

## 🚀 Quick Start

### Prerequisites
- Redis running on localhost:6379 (or configured via env vars)
- Backend server running on port 3000

### Start a Conversation (3 Steps)

#### 1. Create Conversation
```bash
curl -X POST http://localhost:3000/api/v1/chat/start \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "my-session-123",
    "workflowId": "cf769a32-2140-420f-99ed-19abb22ee721",
    "workspaceId": "85fb8ec7-e33c-43ce-bc20-7fa0ac55060b"
  }'
```

#### 2. Send Message
```bash
curl -X POST http://localhost:3000/api/v1/chat/message \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "my-session-123",
    "text": "Hello, how can you help me?"
  }'
```

#### 3. Get History
```bash
curl http://localhost:3000/api/v1/chat/history/my-session-123
```

## 📋 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/chat/start` | Start new conversation |
| POST | `/api/v1/chat/message` | Send message |
| GET | `/api/v1/chat/history/:sessionId` | Get message history |
| GET | `/api/v1/chat/conversation/:sessionId` | Get conversation details |

## 🎯 Common Use Cases

### Use Case 1: Simple Text Chat
```typescript
// 1. Start conversation
const conversation = await fetch('/api/v1/chat/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: 'session_' + Date.now(),
    workflowId: 'your-workflow-id',
    workspaceId: 'your-workspace-id'
  })
});

// 2. Send message
const response = await fetch('/api/v1/chat/message', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: conversation.sessionId,
    text: 'Hello!'
  })
});
```

### Use Case 2: Voice Chat with Metadata
```typescript
await fetch('/api/v1/chat/message', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: 'my-session',
    text: 'Hello from voice',
    isVoice: true,
    voiceMetadata: {
      confidence: 0.95,
      language: 'en-US',
      duration: 3500
    }
  })
});
```

### Use Case 3: Chat with Custom Context
```typescript
await fetch('/api/v1/chat/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: 'my-session',
    workflowId: 'workflow-id',
    workspaceId: 'workspace-id',
    initialContext: {
      systemPrompt: 'You are a customer service agent for Acme Corp',
      systemMessage: 'Welcome to Acme Corp support!'
    },
    metadata: {
      source: 'web',
      language: 'en',
      customerTier: 'premium'
    }
  })
});
```

## 🔧 Integration with Your Code

### Using ChatService Directly
```typescript
import { ChatService } from './core/chat/chat.service';

@Injectable()
export class MyService {
  constructor(private chatService: ChatService) {}

  async handleUserMessage(sessionId: string, text: string) {
    // Add message to conversation
    await this.chatService.addMessage(sessionId, {
      role: 'user',
      content: text
    });

    // Get complete context for AI
    const context = await this.chatService.getConversationContext(
      sessionId,
      text
    );

    // Use context with your AI service
    const aiResponse = await this.aiService.generate(context);

    // Add AI response to conversation
    await this.chatService.addMessage(sessionId, {
      role: 'assistant',
      content: aiResponse
    });
  }
}
```

### Using with MessageQueueService
```typescript
import { MessageQueueService } from './core/services/message-queue.service';
import { ChatService } from './core/chat/chat.service';

@Injectable()
export class MyService {
  constructor(
    private chatService: ChatService,
    private messageQueue: MessageQueueService
  ) {}

  async sendToWorkflow(sessionId: string, text: string) {
    // Get conversation
    const conversation = await this.chatService.getConversation(sessionId);
    
    // Get context
    const context = await this.chatService.getConversationContext(
      sessionId,
      text
    );

    // Send to webhook with full context
    await this.messageQueue.sendMessageToWorkflow(
      conversation.workflowId,
      sessionId,
      text,
      context
    );
  }
}
```

## 📊 Monitoring

### Check Active Sessions
```typescript
const activeSessions = await chatService.getActiveSessions();
console.log(`Active sessions: ${activeSessions.length}`);
```

### Get Cleanup Stats
```typescript
const stats = await cleanupService.getCleanupStats();
console.log(`Active: ${stats.activeSessions}`);
console.log(`Inactive: ${stats.inactiveSessions}`);
```

### Manual Cleanup
```typescript
const result = await cleanupService.triggerCleanup();
console.log(`Cleaned ${result.cleaned} sessions in ${result.duration}ms`);
```

## 🐛 Debugging

### Check if Conversation Exists
```typescript
const conversation = await chatService.getConversation(sessionId);
if (!conversation) {
  console.log('Conversation not found or expired');
}
```

### View Message History
```typescript
const history = await chatService.getHistory(sessionId, {
  limit: 100,
  includeSystem: true
});
console.log(`Messages: ${history.length}`);
history.forEach(msg => {
  console.log(`${msg.role}: ${msg.content}`);
});
```

### Check Redis Keys
```bash
# Connect to Redis
redis-cli

# List all chat conversations
KEYS chat:conversation:*

# Get conversation data
GET chat:conversation:my-session-123

# List messages
ZRANGE chat:messages:my-session-123 0 -1

# Check active sessions
SMEMBERS chat:active:sessions
```

## ⚙️ Configuration

### Environment Variables
```env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Optional: Override TTL values in code
# CHAT_CONVERSATION_TTL=86400
# CHAT_MESSAGE_TTL=86400
# CHAT_INACTIVE_TIMEOUT=3600000
# CHAT_CLEANUP_INTERVAL=1800000
```

### Module Import
```typescript
// app.module.ts
import { ChatModule } from './modules/chat/chat.module';

@Module({
  imports: [
    // ... other modules
    ChatModule,  // Add this
  ],
})
export class AppModule {}
```

## 🧪 Testing

### Run Tests
```bash
# All chat tests
pnpm test chat

# Specific test file
pnpm test chat.service.spec
pnpm test cleanup.service.spec
pnpm test chat.integration.spec

# With coverage
pnpm test:cov chat

# Watch mode
pnpm test:watch chat
```

### Manual Testing Script
```bash
# Windows
test-chat-system.bat

# Linux/Mac
chmod +x test-chat-system.sh
./test-chat-system.sh
```

## 🚨 Common Issues

### Issue: "Conversation not found"
**Cause**: Conversation expired (24h TTL) or never created
**Solution**: Check if conversation exists before sending messages
```typescript
const exists = await chatService.getConversation(sessionId);
if (!exists) {
  await chatService.createConversation(sessionId, options);
}
```

### Issue: "Redis connection error"
**Cause**: Redis not running or wrong configuration
**Solution**: 
```bash
# Check Redis is running
redis-cli ping
# Should return: PONG

# Start Redis if not running
redis-server
```

### Issue: "Voice metadata required"
**Cause**: Sending voice message without metadata
**Solution**: Always include voiceMetadata for voice messages
```typescript
{
  sessionId: 'session-123',
  text: 'Hello',
  isVoice: true,
  voiceMetadata: {  // Required!
    confidence: 0.95,
    language: 'en-US',
    duration: 3500
  }
}
```

### Issue: "Messages not in history"
**Cause**: TTL expired or messages not added
**Solution**: Check TTL and verify addMessage was called
```typescript
// Check conversation age
const conversation = await chatService.getConversation(sessionId);
const age = Date.now() - conversation.createdAt;
console.log(`Conversation age: ${age}ms`);
```

## 📚 Additional Resources

- [Full Implementation Guide](./CHAT_SYSTEM_IMPLEMENTATION.md)
- [Phase 4 Completion Summary](./PHASE_4_CHAT_SYSTEM_COMPLETE.md)
- [Webhook Integration Guide](./WEBHOOK_INTEGRATION_TEST_GUIDE.md)
- [Queue Infrastructure](./QUEUE_INFRASTRUCTURE_EXPLANATION.md)

## 💡 Tips & Best Practices

1. **Session IDs**: Use unique, unpredictable session IDs
   ```typescript
   const sessionId = `session_${Date.now()}_${Math.random().toString(36)}`;
   ```

2. **Error Handling**: Always wrap API calls in try-catch
   ```typescript
   try {
     await chatService.addMessage(sessionId, options);
   } catch (error) {
     console.error('Failed to add message:', error);
     // Handle error appropriately
   }
   ```

3. **Context Management**: Set initial context when starting conversation
   ```typescript
   initialContext: {
     systemPrompt: 'Clear instructions for AI',
     systemMessage: 'Initial greeting'
   }
   ```

4. **History Limits**: Use reasonable limits to avoid memory issues
   ```typescript
   // Good: Limit to recent messages
   const history = await chatService.getHistory(sessionId, { limit: 10 });
   
   // Bad: Loading all messages
   const history = await chatService.getHistory(sessionId, { limit: 10000 });
   ```

5. **Cleanup Monitoring**: Monitor cleanup service for issues
   ```typescript
   const stats = await cleanupService.getCleanupStats();
   if (stats.inactiveSessions > 1000) {
     console.warn('High number of inactive sessions');
   }
   ```

## 🎓 Learning Path

1. **Start Simple**: Create conversation → Send message → Get history
2. **Add Context**: Use initialContext for better AI responses
3. **Voice Support**: Add voice messages with metadata
4. **Integration**: Connect with your AI service
5. **Monitoring**: Set up cleanup monitoring and alerts
6. **Optimization**: Fine-tune TTL and cleanup intervals

## 🤝 Support

For issues or questions:
1. Check [Common Issues](#-common-issues) section
2. Review [Full Documentation](./CHAT_SYSTEM_IMPLEMENTATION.md)
3. Check Redis logs and application logs
4. Run test suite to verify setup

---

**Quick Reference Card**

```
Start:   POST /api/v1/chat/start
Send:    POST /api/v1/chat/message
History: GET  /api/v1/chat/history/:sessionId
Details: GET  /api/v1/chat/conversation/:sessionId

TTL: 24 hours | Cleanup: Every 30 min | Inactive: 1 hour
```
