# Test Payload Examples - Quick Reference

## Configuration
- **Webhook URL:** `http://localhost:5678/webhook/api/n8n/hooks/c3c8482b-e019-483f-b5fa-86ac25fa9889/4`
- **Workflow ID:** `cf769a32-2140-420f-99ed-19abb22ee721`

## 1. Voice Message Payload (Priority: 5)

### Complete Example
```json
{
  "eventType": "message",
  "sessionId": "test-session-voice-123",
  "workflowId": "cf769a32-2140-420f-99ed-19abb22ee721",
  "timestamp": 1699564800000,
  "text": "What properties are available in downtown?",
  "isVoice": true,
  "voiceMetadata": {
    "confidence": 0.95,
    "language": "en-US",
    "duration": 1850
  },
  "connectionContext": {
    "startTime": 1699564795000,
    "callSid": "test-call-sid-456"
  },
  "aiContext": {
    "systemPrompt": "You are a helpful real estate agent assistant",
    "systemMessage": "Current property search for downtown area",
    "conversationHistory": [
      {
        "role": "user",
        "content": "Hi, I'm looking for properties",
        "timestamp": 1699564790000
      },
      {
        "role": "assistant",
        "content": "Great! What area are you interested in?",
        "timestamp": 1699564792000
      }
    ],
    "ragContext": {
      "results": [],
      "query": "",
      "fallbackMessage": "I'm having trouble accessing that information right now."
    }
  }
}
```

### TypeScript Usage
```typescript
await messageQueueService.sendVoiceMessageToWorkflow(
  'cf769a32-2140-420f-99ed-19abb22ee721',
  'test-session-voice-123',
  'What properties are available in downtown?',
  {
    confidence: 0.95,
    language: 'en-US',
    duration: 1850
  },
  {
    systemPrompt: 'You are a helpful real estate agent assistant',
    systemMessage: 'Current property search for downtown area',
    conversationHistory: [
      { role: 'user', content: "Hi, I'm looking for properties", timestamp: Date.now() - 10000 },
      { role: 'assistant', content: 'Great! What area are you interested in?', timestamp: Date.now() - 8000 }
    ]
  },
  'test-connection-456'
);
```

## 2. Call Event Payload (Priority: 10)

### Incoming Call
```json
{
  "eventType": "call",
  "sessionId": "test-call-session-incoming-789",
  "workflowId": "cf769a32-2140-420f-99ed-19abb22ee721",
  "timestamp": 1699564800000,
  "callEvent": {
    "type": "incoming",
    "from": "+1234567890",
    "to": "+0987654321"
  },
  "connectionContext": {
    "startTime": 1699564800000,
    "callSid": "CA12345678901234"
  },
  "aiContext": {
    "systemPrompt": "You are a helpful customer service agent",
    "systemMessage": "Incoming call from customer",
    "conversationHistory": [],
    "ragContext": {
      "results": [],
      "query": "",
      "fallbackMessage": "I'm having trouble accessing that information right now."
    }
  }
}
```

### TypeScript Usage
```typescript
await messageQueueService.sendCallEventToWorkflow(
  'cf769a32-2140-420f-99ed-19abb22ee721',
  'test-call-session-incoming-789',
  {
    type: 'incoming',
    from: '+1234567890',
    to: '+0987654321'
  },
  {
    systemPrompt: 'You are a helpful customer service agent',
    systemMessage: 'Incoming call from customer',
    conversationHistory: []
  },
  'test-call-conn-012'
);
```

### Answered Call
```json
{
  "eventType": "call",
  "callEvent": {
    "type": "answered",
    "from": "+1234567890",
    "to": "+0987654321"
  }
}
```

### DTMF Input
```json
{
  "eventType": "call",
  "callEvent": {
    "type": "dtmf",
    "from": "+1234567890",
    "to": "+0987654321",
    "dtmfDigits": "1234"
  }
}
```

### Hangup
```json
{
  "eventType": "call",
  "callEvent": {
    "type": "hangup",
    "from": "+1234567890",
    "to": "+0987654321"
  },
  "aiContext": {
    "conversationHistory": [
      {
        "role": "user",
        "content": "Thank you",
        "timestamp": 1699564795000
      },
      {
        "role": "assistant",
        "content": "You are welcome! Have a great day.",
        "timestamp": 1699564797000
      }
    ]
  }
}
```

## 3. Chat Message Payload (Priority: 1)

### Simple Chat Message
```json
{
  "eventType": "message",
  "sessionId": "test-chat-session-012",
  "workflowId": "cf769a32-2140-420f-99ed-19abb22ee721",
  "timestamp": 1699564800000,
  "text": "Hello, I have a question about my order",
  "isVoice": false,
  "aiContext": {
    "systemPrompt": "You are a helpful support agent",
    "systemMessage": "Customer support conversation",
    "conversationHistory": [],
    "ragContext": {
      "results": [],
      "query": "",
      "fallbackMessage": "I'm having trouble accessing that information right now."
    }
  }
}
```

### TypeScript Usage
```typescript
await messageQueueService.sendMessageToWorkflow(
  'cf769a32-2140-420f-99ed-19abb22ee721',
  'test-chat-session-012',
  'Hello, I have a question about my order',
  {
    systemPrompt: 'You are a helpful support agent',
    systemMessage: 'Customer support conversation',
    conversationHistory: []
  }
);
```

### Chat with Conversation History
```json
{
  "eventType": "message",
  "text": "What is the status of my order?",
  "isVoice": false,
  "aiContext": {
    "systemPrompt": "You are a support agent",
    "systemMessage": "Order status inquiry",
    "conversationHistory": [
      {
        "role": "user",
        "content": "Hi, I placed an order yesterday",
        "timestamp": 1699564770000
      },
      {
        "role": "assistant",
        "content": "Hello! I can help you with that. What is your order number?",
        "timestamp": 1699564772000
      },
      {
        "role": "user",
        "content": "Order #12345",
        "timestamp": 1699564775000
      },
      {
        "role": "assistant",
        "content": "Thank you. Let me check that for you.",
        "timestamp": 1699564777000
      }
    ]
  }
}
```

## 4. RAG Context Structure (All Payloads)

### Empty Placeholder (Current Implementation)
```json
{
  "ragContext": {
    "results": [],
    "query": "",
    "fallbackMessage": "I'm having trouble accessing that information right now."
  }
}
```

### Custom Fallback Message
```json
{
  "ragContext": {
    "results": [],
    "query": "",
    "fallbackMessage": "Custom fallback message for this specific scenario"
  }
}
```

### Future RAG Implementation (Example)
```json
{
  "ragContext": {
    "results": [
      {
        "source": "property-database",
        "content": "Downtown properties: 3 bedroom condo at $450k, 2 bedroom apartment at $320k"
      },
      {
        "source": "availability-calendar",
        "content": "Both properties available for viewing this week"
      }
    ],
    "query": "downtown properties available",
    "fallbackMessage": "I'm having trouble accessing that information right now."
  }
}
```

## 5. Voice Metadata Examples

### High Confidence
```json
{
  "voiceMetadata": {
    "confidence": 0.95,
    "language": "en-US",
    "duration": 1850
  }
}
```

### Low Confidence
```json
{
  "voiceMetadata": {
    "confidence": 0.65,
    "language": "en-US",
    "duration": 2000
  }
}
```

### Multi-language
```json
{
  "voiceMetadata": {
    "confidence": 0.92,
    "language": "es-ES",
    "duration": 1500
  }
}
```

## 6. Connection Context Examples

### Active Call
```json
{
  "connectionContext": {
    "startTime": 1699564795000,
    "callSid": "CA12345678901234"
  }
}
```

### Long-Running Call
```json
{
  "connectionContext": {
    "startTime": 1699564500000,
    "callSid": "CA98765432109876"
  }
}
```

## 7. Conversation History Examples

### Empty (New Conversation)
```json
{
  "conversationHistory": []
}
```

### Short History (2 exchanges)
```json
{
  "conversationHistory": [
    {
      "role": "user",
      "content": "Hi",
      "timestamp": 1699564790000
    },
    {
      "role": "assistant",
      "content": "Hello! How can I help?",
      "timestamp": 1699564791000
    }
  ]
}
```

### Full History (10 messages - max recommended)
```json
{
  "conversationHistory": [
    { "role": "user", "content": "Message 1", "timestamp": 1699564700000 },
    { "role": "assistant", "content": "Response 1", "timestamp": 1699564701000 },
    { "role": "user", "content": "Message 2", "timestamp": 1699564710000 },
    { "role": "assistant", "content": "Response 2", "timestamp": 1699564711000 },
    { "role": "user", "content": "Message 3", "timestamp": 1699564720000 },
    { "role": "assistant", "content": "Response 3", "timestamp": 1699564721000 },
    { "role": "user", "content": "Message 4", "timestamp": 1699564730000 },
    { "role": "assistant", "content": "Response 4", "timestamp": 1699564731000 },
    { "role": "user", "content": "Message 5", "timestamp": 1699564740000 },
    { "role": "assistant", "content": "Response 5", "timestamp": 1699564741000 }
  ]
}
```

## 8. Priority Levels

| Event Type | Priority | Description |
|------------|----------|-------------|
| Call Events | 10 | Highest - Call lifecycle (incoming, answered, hangup) |
| Voice Messages | 5 | Medium - User voice input with speech recognition |
| Chat Messages | 1 | Lowest - Non-voice text messages |

## 9. Testing Commands

### Run All Payload Tests
```bash
run-payload-tests.bat
```

### Run Specific Test Suite
```bash
npx jest apps/backend/src/core/services/__tests__/webhook-payload.integration.spec.ts -t "Voice Message Payload"
```

### Run Single Test
```bash
npx jest apps/backend/src/core/services/__tests__/webhook-payload.integration.spec.ts -t "should create complete voice message payload"
```

## 10. n8n Webhook Access

### Test Webhook Manually
```bash
curl -X POST http://localhost:5678/webhook/api/n8n/hooks/c3c8482b-e019-483f-b5fa-86ac25fa9889/4 \
  -H "Content-Type: application/json" \
  -H "X-Jibu-Voice: true" \
  -H "X-Jibu-Event-Type: message" \
  -H "X-Jibu-Session-Id: test-123" \
  -d '{
    "eventType": "message",
    "sessionId": "test-123",
    "workflowId": "cf769a32-2140-420f-99ed-19abb22ee721",
    "timestamp": 1699564800000,
    "text": "Test message",
    "isVoice": true
  }'
```

### View Workflow in n8n
Open in browser: `http://localhost:5678/workflow/WLEvJsev2IeGThNc`

## Quick Reference

### Service Methods

```typescript
// Voice Message
messageQueueService.sendVoiceMessageToWorkflow(
  workflowId: string,
  sessionId: string,
  text: string,
  voiceMetadata: VoiceMetadata,
  aiContext?: Partial<AiContext>,
  connectionId?: string
)

// Call Event
messageQueueService.sendCallEventToWorkflow(
  workflowId: string,
  sessionId: string,
  callEvent: CallEventData,
  aiContext?: Partial<AiContext>,
  connectionId?: string
)

// Chat Message
messageQueueService.sendMessageToWorkflow(
  workflowId: string,
  sessionId: string,
  text: string,
  aiContext?: Partial<AiContext>
)
```

### RAG Context Service

```typescript
// Get empty placeholder
ragContextService.getRagContext(query: string)

// Get with custom fallback
ragContextService.getRagContextWithFallback(
  query: string,
  fallbackMessage: string
)

// Check availability
ragContextService.isRagAvailable() // Returns false

// Get default fallback
ragContextService.getDefaultFallbackMessage()
```
