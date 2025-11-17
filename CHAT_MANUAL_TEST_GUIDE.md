# Chat System Manual Testing Guide

## Prerequisites

1. **Backend Server Running**
   ```bash
   cd apps/backend
   pnpm start:dev
   ```
   Server should be running on `http://localhost:4000`

2. **Redis Running**
   ```bash
   redis-cli ping
   # Should return: PONG
   ```

3. **n8n Running** (for webhook integration tests)
   ```bash
   # n8n should be running on http://localhost:5678
   ```

4. **Authentication Token**
   - Get your JWT token from login
   - Set as `YOUR_TOKEN` in commands below

## Test Configuration

```bash
# Test Variables
WORKSPACE_ID=85fb8ec7-e33c-43ce-bc20-7fa0ac55060b
WORKFLOW_ID=cf769a32-2140-420f-99ed-19abb22ee721
SESSION_ID=chat-test-$(date +%s)  # Unique session ID
BASE_URL=http://localhost:4000
```

## Test Scenarios

### Scenario 1: Basic Chat Flow ✅

#### Step 1: Start Conversation

```bash
curl -X POST http://localhost:4000/api/v1/chat/start \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Workspace-ID: 85fb8ec7-e33c-43ce-bc20-7fa0ac55060b" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "chat-test-123",
    "workflowId": "cf769a32-2140-420f-99ed-19abb22ee721",
    "workspaceId": "85fb8ec7-e33c-43ce-bc20-7fa0ac55060b",
    "initialContext": {
      "systemPrompt": "You are a helpful customer service assistant",
      "systemMessage": "Welcome! How can I help you today?"
    }
  }'
```

**Expected Response**:
```json
{
  "sessionId": "chat-test-123",
  "workflowId": "cf769a32-2140-420f-99ed-19abb22ee721",
  "workspaceId": "85fb8ec7-e33c-43ce-bc20-7fa0ac55060b",
  "participants": [
    {
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
    "systemPrompt": "You are a helpful customer service assistant",
    "systemMessage": "Welcome! How can I help you today?"
  }
}
```

**Validation**:
- ✅ Status code: 201 Created
- ✅ Response includes sessionId
- ✅ Status is "active"
- ✅ Context matches input
- ✅ Participants array has 2 entries

#### Step 2: Send First Message

```bash
curl -X POST http://localhost:4000/api/v1/chat/message \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Workspace-ID: 85fb8ec7-e33c-43ce-bc20-7fa0ac55060b" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "chat-test-123",
    "text": "Hello, I need help with my order"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "message": {
    "role": "user",
    "content": "Hello, I need help with my order",
    "timestamp": 1700000001000,
    "isVoice": false
  }
}
```

**Validation**:
- ✅ Status code: 200 OK
- ✅ success is true
- ✅ Message role is "user"
- ✅ Content matches input
- ✅ Timestamp is present

#### Step 3: Send Second Message

```bash
curl -X POST http://localhost:4000/api/v1/chat/message \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Workspace-ID: 85fb8ec7-e33c-43ce-bc20-7fa0ac55060b" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "chat-test-123",
    "text": "My order number is 12345"
  }'
```

#### Step 4: Get Conversation History

```bash
curl -X GET "http://localhost:4000/api/v1/chat/history/chat-test-123?limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Workspace-ID: 85fb8ec7-e33c-43ce-bc20-7fa0ac55060b"
```

**Expected Response**:
```json
{
  "sessionId": "chat-test-123",
  "messages": [
    {
      "role": "user",
      "content": "Hello, I need help with my order",
      "timestamp": 1700000001000,
      "isVoice": false
    },
    {
      "role": "user",
      "content": "My order number is 12345",
      "timestamp": 1700000002000,
      "isVoice": false
    }
  ]
}
```

**Validation**:
- ✅ Status code: 200 OK
- ✅ Messages in chronological order
- ✅ Both messages present
- ✅ Content matches sent messages

#### Step 5: Get Conversation Details

```bash
curl -X GET "http://localhost:4000/api/v1/chat/conversation/chat-test-123" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Workspace-ID: 85fb8ec7-e33c-43ce-bc20-7fa0ac55060b"
```

**Expected Response**:
```json
{
  "sessionId": "chat-test-123",
  "workflowId": "cf769a32-2140-420f-99ed-19abb22ee721",
  "workspaceId": "85fb8ec7-e33c-43ce-bc20-7fa0ac55060b",
  "status": "active",
  "lastActivity": 1700000002000,
  ...
}
```

**Validation**:
- ✅ Status code: 200 OK
- ✅ lastActivity updated
- ✅ Status still "active"

---

### Scenario 2: Voice Message Flow ✅

#### Send Voice Message

```bash
curl -X POST http://localhost:4000/api/v1/chat/message \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Workspace-ID: 85fb8ec7-e33c-43ce-bc20-7fa0ac55060b" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "chat-test-123",
    "text": "Hello from voice",
    "isVoice": true,
    "voiceMetadata": {
      "confidence": 0.95,
      "language": "en-US",
      "duration": 3500
    }
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "message": {
    "role": "user",
    "content": "Hello from voice",
    "timestamp": 1700000003000,
    "isVoice": true,
    "confidence": 0.95,
    "language": "en-US",
    "duration": 3500
  }
}
```

**Validation**:
- ✅ Status code: 200 OK
- ✅ isVoice is true
- ✅ Voice metadata included
- ✅ All metadata fields present

---

### Scenario 3: Webhook Integration Test 🔗

#### Verify Webhook Delivery

1. **Send Message** (as above)

2. **Check n8n Executions**
   - Go to: http://localhost:5678/workflow/WLEvJsev2IeGThNc
   - Click "Executions" tab
   - Find latest execution

3. **Verify Payload Structure**

Expected webhook payload:
```json
{
  "eventType": "message",
  "sessionId": "chat-test-123",
  "workflowId": "cf769a32-2140-420f-99ed-19abb22ee721",
  "timestamp": 1700000001000,
  "text": "Hello, I need help with my order",
  "isVoice": false,
  "aiContext": {
    "systemPrompt": "You are a helpful customer service assistant",
    "systemMessage": "Welcome! How can I help you today?",
    "conversationHistory": [
      {
        "role": "user",
        "content": "Hello, I need help with my order",
        "timestamp": 1700000001000
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

**Validation**:
- ✅ Webhook received in n8n
- ✅ Complete payload structure
- ✅ AI context included
- ✅ Conversation history present
- ✅ RAG context with placeholder

---

### Scenario 4: Error Handling Tests ❌

#### Test 1: Non-existent Conversation

```bash
curl -X POST http://localhost:4000/api/v1/chat/message \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Workspace-ID: 85fb8ec7-e33c-43ce-bc20-7fa0ac55060b" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "non-existent-session",
    "text": "Hello"
  }'
```

**Expected Response**:
- Status code: 404 Not Found
- Error message about conversation not found

#### Test 2: Invalid Workflow ID

```bash
curl -X POST http://localhost:4000/api/v1/chat/start \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Workspace-ID: 85fb8ec7-e33c-43ce-bc20-7fa0ac55060b" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-session",
    "workflowId": "invalid-uuid",
    "workspaceId": "85fb8ec7-e33c-43ce-bc20-7fa0ac55060b"
  }'
```

**Expected Response**:
- Status code: 400 Bad Request
- Validation error for workflowId

#### Test 3: Voice Message Without Metadata

```bash
curl -X POST http://localhost:4000/api/v1/chat/message \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Workspace-ID: 85fb8ec7-e33c-43ce-bc20-7fa0ac55060b" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "chat-test-123",
    "text": "Hello from voice",
    "isVoice": true
  }'
```

**Expected Response**:
- Status code: 400 Bad Request
- Error message about missing voice metadata

---

### Scenario 5: Redis Verification 🔍

#### Check Redis Keys

```bash
# Connect to Redis
redis-cli

# List all chat conversations
KEYS chat:conversation:*

# Get conversation data
GET chat:conversation:chat-test-123

# List messages (sorted set)
ZRANGE chat:messages:chat-test-123 0 -1

# Check active sessions
SMEMBERS chat:active:sessions

# Check TTL
TTL chat:conversation:chat-test-123
TTL chat:messages:chat-test-123
```

**Expected Results**:
- ✅ Conversation key exists
- ✅ Messages in sorted set
- ✅ Session in active sessions
- ✅ TTL is 86400 seconds (24 hours)

---

## Performance Testing

### Latency Measurements

Use `time` command or measure response times:

```bash
# Measure conversation creation
time curl -X POST http://localhost:4000/api/v1/chat/start ...

# Measure message sending
time curl -X POST http://localhost:4000/api/v1/chat/message ...

# Measure history retrieval
time curl -X GET http://localhost:4000/api/v1/chat/history/...
```

**Targets**:
- Conversation creation: < 100ms
- Message sending: < 50ms
- History retrieval: < 100ms

---

## Cleanup Testing

### Manual Cleanup Trigger

```bash
# Trigger cleanup manually
curl -X POST http://localhost:4000/api/v1/chat/cleanup/trigger \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Workspace-ID: 85fb8ec7-e33c-43ce-bc20-7fa0ac55060b"
```

### Get Cleanup Stats

```bash
curl -X GET http://localhost:4000/api/v1/chat/cleanup/stats \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Workspace-ID: 85fb8ec7-e33c-43ce-bc20-7fa0ac55060b"
```

---

## Troubleshooting

### Issue: 401 Unauthorized
**Solution**: Ensure you have a valid JWT token

### Issue: 404 Not Found
**Solution**: Check that conversation was created first

### Issue: Redis Connection Error
**Solution**: 
```bash
# Check Redis is running
redis-cli ping

# Check Redis configuration
cat apps/backend/.env | grep REDIS
```

### Issue: Webhook Not Received
**Solution**:
1. Check n8n is running
2. Verify workflow is activated
3. Check webhook URL is correct
4. Review n8n logs

---

## Test Checklist

### Basic Functionality
- [ ] Start conversation successfully
- [ ] Send text message
- [ ] Send voice message with metadata
- [ ] Get conversation history
- [ ] Get conversation details
- [ ] Messages in chronological order

### Error Handling
- [ ] 404 for non-existent conversation
- [ ] 400 for invalid workflow ID
- [ ] 400 for voice message without metadata
- [ ] Proper error messages

### Redis Integration
- [ ] Conversation stored in Redis
- [ ] Messages in sorted set
- [ ] TTL set correctly (86400s)
- [ ] Active sessions tracked

### Webhook Integration
- [ ] Webhook received in n8n
- [ ] Complete payload structure
- [ ] AI context included
- [ ] Conversation history present
- [ ] RAG context placeholder

### Performance
- [ ] Conversation creation < 100ms
- [ ] Message sending < 50ms
- [ ] History retrieval < 100ms

---

## Quick Test Script

Save as `test-chat-api.sh`:

```bash
#!/bin/bash

TOKEN="YOUR_TOKEN_HERE"
WORKSPACE="85fb8ec7-e33c-43ce-bc20-7fa0ac55060b"
WORKFLOW="cf769a32-2140-420f-99ed-19abb22ee721"
SESSION="chat-test-$(date +%s)"
BASE="http://localhost:4000"

echo "Testing Chat System API"
echo "Session ID: $SESSION"
echo ""

echo "1. Starting conversation..."
curl -X POST "$BASE/api/v1/chat/start" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Workspace-ID: $WORKSPACE" \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION\",\"workflowId\":\"$WORKFLOW\",\"workspaceId\":\"$WORKSPACE\"}"
echo -e "\n"

echo "2. Sending message..."
curl -X POST "$BASE/api/v1/chat/message" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Workspace-ID: $WORKSPACE" \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION\",\"text\":\"Hello, test message\"}"
echo -e "\n"

echo "3. Getting history..."
curl -X GET "$BASE/api/v1/chat/history/$SESSION" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Workspace-ID: $WORKSPACE"
echo -e "\n"

echo "Test complete!"
```

---

## Next Steps

After manual testing:
1. Document any issues found
2. Verify webhook delivery in n8n
3. Test with concurrent users
4. Load test with multiple sessions
5. Monitor Redis memory usage
6. Review application logs

---

**Manual Testing Status**: Ready for execution
**Prerequisites**: Backend running, Redis running, Auth token obtained
**Estimated Time**: 15-20 minutes for complete test suite
