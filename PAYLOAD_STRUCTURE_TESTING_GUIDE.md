# Webhook Payload Structure - Integration Testing Guide

## Overview

Comprehensive integration tests for Phase 3 payload structure implementation, validating complete conversation context delivery to n8n webhooks.

## Test Configuration

### n8n Webhook Details
- **Webhook URL:** `http://localhost:5678/webhook/api/n8n/hooks/c3c8482b-e019-483f-b5fa-86ac25fa9889/4`
- **Workflow URL:** `http://localhost:5678/workflow/WLEvJsev2IeGThNc`
- **Workflow ID:** `cf769a32-2140-420f-99ed-19abb22ee721`

### Test File Location
`apps/backend/src/core/services/__tests__/webhook-payload.integration.spec.ts`

## Running the Tests

### Option 1: Using Batch File (Recommended)
```bash
# From project root directory
run-payload-tests.bat
```

### Option 2: Direct Jest Command
```bash
npx jest apps/backend/src/core/services/__tests__/webhook-payload.integration.spec.ts --runInBand --verbose --no-cache
```

### Option 3: Watch Mode (Development)
```bash
npx jest apps/backend/src/core/services/__tests__/webhook-payload.integration.spec.ts --watch
```

## Test Suites

### 1. Voice Message Payload Tests

**Purpose:** Validate complete voice message payloads with metadata and conversation context

#### Test Cases:

##### ✅ Complete Voice Message with Metadata
- **Validates:** Voice metadata (confidence, language, duration)
- **Validates:** Connection context (callSid, startTime)
- **Validates:** Conversation history (2 previous messages)
- **Validates:** RAG placeholder with fallback message
- **Priority:** 5 (VOICE_MESSAGES)

**Expected Payload Structure:**
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
    "startTime": 1699564800000,
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

##### ✅ Voice Message with Empty Conversation History
- **Validates:** Handles empty conversation history gracefully
- **Validates:** Voice metadata still included
- **Expected:** No errors, successful processing

##### ✅ Voice Message Without Connection Context
- **Validates:** Processes successfully without connectionId
- **Validates:** Voice metadata included
- **Expected:** Warning logged, message processed

##### ✅ Voice Message with Low Confidence Score
- **Validates:** Accepts low confidence scores (0.65)
- **Validates:** System message indicates low confidence
- **Expected:** Successful processing with metadata

### 2. Call Event Payload Tests

**Purpose:** Validate call lifecycle event payloads with connection context

#### Test Cases:

##### ✅ Incoming Call Event
- **Event Type:** `incoming`
- **Validates:** Call event details (from, to)
- **Validates:** Connection context (callSid)
- **Priority:** 10 (VOICE_EVENTS - highest)

**Expected Payload Structure:**
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

##### ✅ Answered Call Event
- **Event Type:** `answered`
- **Validates:** Connection remains active
- **Validates:** Call event properly structured

##### ✅ DTMF Input Event
- **Event Type:** `dtmf`
- **Validates:** DTMF digits included (`1234`)
- **Validates:** IVR system prompt

##### ✅ Hangup Event
- **Event Type:** `hangup`
- **Validates:** Conversation history included
- **Validates:** Call termination handled

##### ✅ Call Event Without Connection Context
- **Validates:** Warning logged for missing connection
- **Expected:** Processing continues without failure

### 3. Chat Message Payload Tests

**Purpose:** Validate non-voice message payloads with standard priority

#### Test Cases:

##### ✅ Complete Chat Message with Standard Priority
- **Priority:** 1 (CHAT_MESSAGES)
- **Validates:** No voice metadata
- **Validates:** AI context included

**Expected Payload Structure:**
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

##### ✅ Chat Message with Conversation History
- **Validates:** 4 previous messages in history
- **Validates:** Order status inquiry context

##### ✅ Chat Message Without AI Context
- **Validates:** Minimal context accepted
- **Expected:** Default empty AI context used

### 4. RAG Context Placeholder Tests

**Purpose:** Validate RAG placeholder implementation

#### Test Cases:

##### ✅ Empty RAG Context with Fallback Message
- **Validates:** `results` array is empty
- **Validates:** `query` is empty string
- **Validates:** Default fallback message present

##### ✅ Custom Fallback Message
- **Validates:** Custom fallback message accepted
- **Expected:** Custom message in RAG context

##### ✅ RAG Availability Check
- **Validates:** `isRagAvailable()` returns `false`
- **Expected:** RAG not yet implemented

##### ✅ Default Fallback Message Retrieval
- **Validates:** Default message accessible
- **Expected:** "I'm having trouble accessing that information right now."

### 5. Priority Processing Tests

**Purpose:** Validate priority assignment for different event types

#### Test Cases:

##### ✅ Correct Priority Assignment
- **Call Events:** Priority 10 (highest)
- **Voice Messages:** Priority 5 (medium)
- **Chat Messages:** Priority 1 (lowest)
- **Validates:** All process successfully

### 6. Error Handling Tests

**Purpose:** Validate error scenarios and graceful degradation

#### Test Cases:

##### ✅ Invalid Workflow ID
- **Expected:** Error thrown
- **Validates:** Proper error handling

##### ✅ Missing Webhook URL
- **Expected:** Warning logged, error thrown
- **Validates:** Circuit breaker not triggered prematurely

### 7. Connection Context Management Tests

**Purpose:** Validate connection state management

#### Test Cases:

##### ✅ Create and Retrieve Connection Context
- **Validates:** Connection creation
- **Validates:** Connection retrieval
- **Validates:** Active state tracking

##### ✅ Update Connection Heartbeat
- **Validates:** Heartbeat timestamp updates
- **Expected:** New timestamp > old timestamp

### 8. Queue Statistics Tests

**Purpose:** Validate queue monitoring capabilities

#### Test Cases:

##### ✅ Retrieve Queue Statistics
- **Validates:** waiting, active, completed, failed, delayed counts
- **Expected:** All numeric values

##### ✅ Check Queue Health
- **Validates:** Health status boolean
- **Expected:** Health check completes

## Success Criteria

### ✅ All Payloads Delivered Successfully
- Voice messages queued with priority 5
- Call events queued with priority 10
- Chat messages queued with priority 1

### ✅ Complete Context Included
- Voice metadata (confidence, language, duration)
- Connection context (callSid, startTime)
- Conversation history (up to 10 messages)
- RAG placeholders with fallback messages

### ✅ Error Handling Works
- Invalid workflow IDs rejected
- Missing connections handled gracefully
- Empty conversation history accepted

### ✅ Priority System Functional
- Voice events processed first
- Voice messages processed second
- Chat messages processed last

## Test Execution Flow

```
1. Setup
   ├─ Initialize test module
   ├─ Setup Redis connection
   ├─ Pre-warm webhook URL cache
   └─ Initialize services

2. Run Test Suites
   ├─ Voice Message Tests (4 tests)
   ├─ Call Event Tests (5 tests)
   ├─ Chat Message Tests (3 tests)
   ├─ RAG Context Tests (4 tests)
   ├─ Priority Tests (1 test)
   ├─ Error Handling Tests (2 tests)
   ├─ Connection Management Tests (2 tests)
   └─ Queue Statistics Tests (2 tests)

3. Cleanup
   ├─ Clear webhook URL cache
   ├─ Delete test connections
   └─ Close test module
```

## Expected Test Results

### Total Tests: 23

#### Voice Message Payload: 4 tests
- ✅ Complete voice message with metadata
- ✅ Empty conversation history
- ✅ Without connection context
- ✅ Low confidence score

#### Call Event Payload: 5 tests
- ✅ Incoming call
- ✅ Answered call
- ✅ DTMF input
- ✅ Hangup
- ✅ Without connection context

#### Chat Message Payload: 3 tests
- ✅ Standard priority
- ✅ With conversation history
- ✅ Without AI context

#### RAG Context Placeholder: 4 tests
- ✅ Empty context with fallback
- ✅ Custom fallback message
- ✅ Availability check
- ✅ Default fallback retrieval

#### Priority Processing: 1 test
- ✅ Correct priority assignment

#### Error Handling: 2 tests
- ✅ Invalid workflow ID
- ✅ Missing webhook URL

#### Connection Management: 2 tests
- ✅ Create and retrieve
- ✅ Update heartbeat

#### Queue Statistics: 2 tests
- ✅ Retrieve statistics
- ✅ Check health

## Troubleshooting

### Test Failures

#### Redis Connection Issues
```bash
# Check Redis is running
redis-cli ping
# Should return: PONG
```

#### n8n Webhook Not Available
```bash
# Verify n8n is running
curl http://localhost:5678/webhook/api/n8n/hooks/c3c8482b-e019-483f-b5fa-86ac25fa9889/4
# Should return 200 OK or workflow response
```

#### Queue Connection Issues
```bash
# Check Bull queue connection
# Verify REDIS_HOST and REDIS_PORT in .env.test
```

### Common Issues

1. **Timeout Errors**
   - Increase Jest timeout: `jest.setTimeout(30000)`
   - Check Redis connection latency

2. **Connection Context Not Found**
   - Verify connection created before use
   - Check connection TTL settings

3. **Webhook URL Cache Miss**
   - Ensure pre-warming in beforeAll()
   - Verify workflow ID matches

## Performance Benchmarks

### Target Latencies
- **Voice Message Enqueuing:** <50ms
- **Call Event Enqueuing:** <50ms
- **Chat Message Enqueuing:** <100ms
- **Webhook Delivery:** <500ms (voice), <10s (chat)

### Expected Metrics
- **Cache Hit Rate:** >97% for active workflows
- **Fallback Rate:** <3% of voice interactions
- **Queue Processing:** Millions of concurrent calls supported

## Next Steps After Testing

1. **Verify Webhook Delivery**
   - Check n8n workflow execution logs
   - Verify payload structure in n8n

2. **Monitor Performance**
   - Track enqueuing latency
   - Monitor queue depth
   - Check circuit breaker triggers

3. **Production Deployment**
   - Update environment variables
   - Configure production webhook URLs
   - Enable monitoring and alerting

## Additional Resources

- **Phase 3 Documentation:** `PHASE_3_PAYLOAD_STRUCTURE_COMPLETE.md`
- **Queue Definitions:** `libs/queue-definitions/src/index.ts`
- **Message Queue Service:** `apps/backend/src/core/services/message-queue.service.ts`
- **RAG Context Service:** `apps/backend/src/core/services/rag-context.service.ts`

## Support

For issues or questions:
1. Check test output for specific error messages
2. Review payload structure in queue-definitions
3. Verify n8n webhook configuration
4. Check Redis connection and queue health
