# Chat System Initial Testing Guide

## 🎯 Objective
Test the basic message-only chat system end-to-end: Frontend API → Backend → Worker → Webhook → n8n

---

## ✅ Prerequisites Checklist

### 1. Backend Running
```bash
cd apps/backend
pnpm start:dev
# Should be running on http://localhost:4000
```

**Verify**:
```bash
curl http://localhost:4000/api/health
# Expected: {"status":"ok"}
```

### 2. Worker Running
```bash
cd apps/worker
pnpm start:dev
# WebhookDeliveryProcessor should be active
```

**Verify in logs**:
- `[WebhookDeliveryProcessor] Processor initialized`
- `[Bull] Queue connected`

### 3. Redis Running
```bash
redis-cli ping
# Expected: PONG
```

### 4. n8n Running
```bash
# n8n should be running on http://localhost:5678
```

**Verify**:
- Open: http://localhost:5678
- Check workflow is ACTIVATED (toggle switch ON)
- Workflow ID: `cf769a32-2140-420f-99ed-19abb22ee721`

### 5. Get Authentication Token

**Option A: From Browser DevTools**
1. Login to frontend
2. Open DevTools → Application → Local Storage
3. Find Supabase session token

**Option B: From Supabase**
```bash
# Login and get token from response
```

---

## 🧪 Test Execution

### Test Configuration

```bash
# Set these variables
export TOKEN="YOUR_JWT_TOKEN_HERE"
export WORKSPACE_ID="85fb8ec7-e33c-43ce-bc20-7fa0ac55060b"
export WORKFLOW_ID="cf769a32-2140-420f-99ed-19abb22ee721"
export BASE_URL="http://localhost:4000"
```

---

## Step 1: Create Chat

### Command:
```bash
curl -X POST http://localhost:4000/api/v1/chats \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Workspace-ID: $WORKSPACE_ID" \
  -H "Content-Type: application/json" \
  -d "{
    \"assistantId\": \"$WORKFLOW_ID\",
    \"sessionId\": \"test-session-$(date +%s)\",
    \"sessionType\": \"chat\",
    \"name\": \"Initial Test Chat\"
  }"
```

### Expected Response:
```json
{
  "id": "chat-uuid-here",
  "sessionId": "test-session-1234567890",
  "assistantId": "cf769a32-2140-420f-99ed-19abb22ee721",
  "workspaceId": "85fb8ec7-e33c-43ce-bc20-7fa0ac55060b",
  "name": "Initial Test Chat",
  "sessionType": "chat",
  "createdAt": "2025-11-17T09:00:00.000Z"
}
```

### Verification:
- ✅ Status code: 201 Created
- ✅ Response includes `id` and `sessionId`
- ✅ `assistantId` matches workflow ID

**Save the chat ID for next step**:
```bash
export CHAT_ID="chat-uuid-from-response"
```

---

## Step 2: Send Message

### Command:
```bash
curl -X POST http://localhost:4000/api/v1/chats/$CHAT_ID/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Workspace-ID: $WORKSPACE_ID" \
  -H "Content-Type: application/json" \
  -d "{
    \"content\": \"Hello, this is a test message from the chat system\",
    \"role\": \"user\",
    \"type\": \"text\"
  }"
```

### Expected Response:
```json
{
  "id": "message-uuid-here",
  "content": "Hello, this is a test message from the chat system",
  "role": "user",
  "sequenceId": 0,
  "type": "text",
  "createdAt": "2025-11-17T09:01:00.000Z"
}
```

### Verification:
- ✅ Status code: 201 Created
- ✅ Response includes message details
- ✅ `sequenceId` starts at 0

---

## Step 3: Verify Webhook Delivery

### Check n8n Executions

1. **Open n8n**:
   ```
   http://localhost:5678/workflow/WLEvJsev2IeGThNc
   ```

2. **Click "Executions" tab** (right side)

3. **Find latest execution** (should be within seconds)

4. **Verify Payload Structure**:
   ```json
   {
     "eventType": "message",
     "sessionId": "test-session-1234567890",
     "workflowId": "cf769a32-2140-420f-99ed-19abb22ee721",
     "timestamp": 1700000000000,
     "message": {
       "text": "Hello, this is a test message from the chat system",
       "role": "user",
       "sequenceId": 0
     },
     "context": {
       "conversationHistory": [
         {
           "role": "user",
           "content": "Hello, this is a test message from the chat system",
           "timestamp": 1700000000000
         }
       ],
       "systemPrompt": "You are a helpful assistant",
       "ragContext": {
         "results": [],
         "query": "",
         "fallbackMessage": "I'm having trouble accessing that information right now."
       }
     }
   }
   ```

### Expected in n8n:
- ✅ Execution appears within 1-5 seconds
- ✅ Status: Success (green checkmark)
- ✅ Payload includes complete context structure
- ✅ `conversationHistory` contains the message
- ✅ `ragContext` shows placeholder with fallback message

---

## Step 4: Check Worker Logs

### Look for these log entries:

```
[WebhookDeliveryProcessor] Processing chat message
[WebhookDeliveryProcessor] Job ID: webhook-delivery-xxx
[WebhookDeliveryProcessor] Workflow ID: cf769a32-2140-420f-99ed-19abb22ee721
[WebhookDeliveryProcessor] Session ID: test-session-1234567890
[WebhookDeliveryProcessor] Webhook URL: http://localhost:5678/webhook/...
[WebhookDeliveryProcessor] Payload size: XXX bytes
[WebhookDeliveryProcessor] Delivery successful - Status: 200
```

### Verification:
- ✅ Job picked up from queue
- ✅ Webhook URL correct
- ✅ Delivery successful (200 status)
- ✅ No Redis connection errors

---

## Step 5: Send Second Message (Test History)

### Command:
```bash
curl -X POST http://localhost:4000/api/v1/chats/$CHAT_ID/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Workspace-ID: $WORKSPACE_ID" \
  -H "Content-Type: application/json" \
  -d "{
    \"content\": \"This is my second message to test conversation history\",
    \"role\": \"user\",
    \"type\": \"text\"
  }"
```

### Verify in n8n:
- ✅ New execution appears
- ✅ `conversationHistory` now has 2 messages
- ✅ Messages in chronological order
- ✅ `sequenceId` incremented to 1

---

## Step 6: Get Chat History

### Command:
```bash
curl -X GET "http://localhost:4000/api/v1/chats/$CHAT_ID/messages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Workspace-ID: $WORKSPACE_ID"
```

### Expected Response:
```json
[
  {
    "id": "msg-1",
    "content": "Hello, this is a test message from the chat system",
    "role": "user",
    "sequenceId": 0,
    "createdAt": "2025-11-17T09:01:00.000Z"
  },
  {
    "id": "msg-2",
    "content": "This is my second message to test conversation history",
    "role": "user",
    "sequenceId": 1,
    "createdAt": "2025-11-17T09:02:00.000Z"
  }
]
```

### Verification:
- ✅ Both messages returned
- ✅ Chronological order
- ✅ Correct sequence IDs

---

## 🔍 Troubleshooting

### Issue 1: No Execution in n8n

**Possible Causes**:
1. Workflow not activated
2. Webhook URL mismatch
3. Worker not processing jobs
4. Redis connection issue

**Solutions**:

#### Check 1: Workflow Activation
```
1. Open n8n workflow
2. Check toggle switch in top-right is ON (blue)
3. If OFF, click to activate
```

#### Check 2: Webhook URL
```bash
# In n8n, click webhook node
# Copy the "Test URL" or "Production URL"
# Compare with backend configuration
```

**Backend webhook URL should match exactly**:
```
http://localhost:5678/webhook/api/n8n/hooks/c3c8482b-e019-483f-b5fa-86ac25fa9889/4
```

#### Check 3: Worker Status
```bash
# Check worker logs
tail -f apps/worker/logs/worker.log

# Should see:
[WebhookDeliveryProcessor] Processor initialized
[Bull] Queue connected
```

**If not running**:
```bash
cd apps/worker
pnpm start:dev
```

#### Check 4: Redis Connection
```bash
# Test Redis
redis-cli ping
# Expected: PONG

# Check Redis keys
redis-cli
> KEYS bull:*
# Should show queue keys
```

**If Redis not running**:
```bash
redis-server
```

---

### Issue 2: 401 Unauthorized

**Cause**: Invalid or expired JWT token

**Solution**:
1. Get fresh token from Supabase
2. Update `$TOKEN` variable
3. Retry request

---

### Issue 3: 404 Not Found (Chat)

**Cause**: Chat ID doesn't exist or wrong workspace

**Solution**:
1. Verify chat was created successfully
2. Check `CHAT_ID` variable is correct
3. Ensure `X-Workspace-ID` header matches

---

### Issue 4: Worker Logs Show "undefined redisClient"

**Cause**: Redis client not initialized in worker

**Solution**:
```bash
# Check worker environment variables
cat apps/worker/.env

# Should have:
REDIS_HOST=localhost
REDIS_PORT=6379
```

**Restart worker**:
```bash
cd apps/worker
pnpm start:dev
```

---

### Issue 5: Webhook Delivery Fails (500 Error)

**Cause**: n8n webhook endpoint error

**Solution**:
1. Check n8n logs for errors
2. Verify webhook node configuration
3. Test webhook URL directly:
   ```bash
   curl -X POST http://localhost:5678/webhook/api/n8n/hooks/c3c8482b-e019-483f-b5fa-86ac25fa9889/4 \
     -H "Content-Type: application/json" \
     -d '{"test": "payload"}'
   ```

---

## ✅ Success Indicators

### All Systems Working:
- ✅ Chat created successfully (201 status)
- ✅ Message sent successfully (201 status)
- ✅ Worker logs show job processing
- ✅ n8n execution appears within 5 seconds
- ✅ Payload includes complete context structure
- ✅ Conversation history present in payload
- ✅ RAG context shows placeholder
- ✅ No errors in any logs

---

## 📊 Expected Payload in n8n

### Complete Structure:
```json
{
  "eventType": "message",
  "sessionId": "test-session-1234567890",
  "workflowId": "cf769a32-2140-420f-99ed-19abb22ee721",
  "workspaceId": "85fb8ec7-e33c-43ce-bc20-7fa0ac55060b",
  "timestamp": 1700000000000,
  "message": {
    "text": "Hello, this is a test message from the chat system",
    "role": "user",
    "sequenceId": 0,
    "type": "text"
  },
  "context": {
    "systemPrompt": "You are a helpful assistant",
    "systemMessage": "How can I help you today?",
    "conversationHistory": [
      {
        "role": "user",
        "content": "Hello, this is a test message from the chat system",
        "timestamp": 1700000000000
      }
    ],
    "ragContext": {
      "results": [],
      "query": "",
      "fallbackMessage": "I'm having trouble accessing that information right now."
    }
  },
  "metadata": {
    "source": "chat-api",
    "version": "1.0"
  }
}
```

### Key Fields to Verify:
- ✅ `eventType`: "message"
- ✅ `sessionId`: Matches chat session
- ✅ `workflowId`: Matches assistant ID
- ✅ `message.text`: Message content
- ✅ `context.conversationHistory`: Array with messages
- ✅ `context.ragContext`: Placeholder structure
- ✅ `timestamp`: Unix timestamp

---

## 🎯 Test Completion Checklist

- [ ] Backend running on port 4000
- [ ] Worker running and processing jobs
- [ ] Redis running and accessible
- [ ] n8n running with workflow activated
- [ ] JWT token obtained
- [ ] Chat created successfully
- [ ] First message sent
- [ ] n8n execution appeared
- [ ] Payload structure verified
- [ ] Second message sent
- [ ] Conversation history updated
- [ ] Chat history retrieved
- [ ] All logs show success

---

## 📝 Test Results Template

```
## Test Execution Results

**Date**: [DATE]
**Tester**: [NAME]

### Environment Status
- [ ] Backend: Running ✅ / Not Running ❌
- [ ] Worker: Running ✅ / Not Running ❌
- [ ] Redis: Running ✅ / Not Running ❌
- [ ] n8n: Running ✅ / Not Running ❌

### Test Results
- [ ] Chat Creation: Pass ✅ / Fail ❌
- [ ] Message Send: Pass ✅ / Fail ❌
- [ ] Webhook Delivery: Pass ✅ / Fail ❌
- [ ] n8n Execution: Pass ✅ / Fail ❌
- [ ] Payload Structure: Pass ✅ / Fail ❌
- [ ] Conversation History: Pass ✅ / Fail ❌

### Issues Found
[List any issues encountered]

### Notes
[Additional observations]
```

---

## 🚀 Next Steps After Successful Test

1. **Test voice messages** with metadata
2. **Test Redis chat system** (Phase 4 full implementation)
3. **Load testing** with multiple concurrent chats
4. **Integration with AI service** for responses
5. **Frontend integration** testing

---

## 📚 Related Documentation

- **Chat System Implementation**: `CHAT_SYSTEM_IMPLEMENTATION.md`
- **Frontend API Guide**: `FRONTEND_API_UTILS_GUIDE.md`
- **Webhook Integration**: `WEBHOOK_INTEGRATION_TEST_GUIDE.md`
- **Test Results**: `CHAT_SYSTEM_TEST_RESULTS.md`

---

**Status**: Ready for Manual Testing  
**Prerequisites**: All services running  
**Estimated Time**: 15-20 minutes
