# Quick Start - Payload Structure Tests

## Prerequisites

✅ Redis running on `localhost:6379`  
✅ Node.js and npm/pnpm installed  
✅ Dependencies installed (`pnpm install`)  
✅ n8n running (optional, for full integration)

## Run Tests (3 Simple Steps)

### Step 1: Ensure Services Running
```bash
# Check Redis
redis-cli ping
# Should return: PONG

# Optional: Check n8n
curl http://localhost:5678/webhook/api/n8n/hooks/c3c8482b-e019-483f-b5fa-86ac25fa9889/4
# Should return 200 OK
```

### Step 2: Run Tests
```bash
# From project root directory
run-payload-tests.bat
```

### Step 3: Verify Results
Look for:
```
Test Suites: 1 passed, 1 total
Tests:       23 passed, 23 total
```

## What Gets Tested

### ✅ Voice Messages (4 tests)
- Complete payload with metadata
- Empty conversation history
- Without connection context
- Low confidence scores

### ✅ Call Events (5 tests)
- Incoming calls
- Answered calls
- DTMF input
- Hangups
- Missing connection handling

### ✅ Chat Messages (3 tests)
- Standard priority
- With conversation history
- Without AI context

### ✅ RAG Placeholders (4 tests)
- Empty context
- Custom fallbacks
- Availability check
- Default messages

### ✅ System Features (7 tests)
- Priority processing
- Error handling
- Connection management
- Queue statistics

## Expected Output

```
========================================
Webhook Payload Structure Integration Test
========================================

Using Webhook URL: http://localhost:5678/webhook/api/n8n/hooks/c3c8482b-e019-483f-b5fa-86ac25fa9889/4
Using Workflow URL: http://localhost:5678/workflow/WLEvJsev2IeGThNc

Running integration tests for payload structure...

PASS  apps/backend/src/core/services/__tests__/webhook-payload.integration.spec.ts
  Webhook Payload Structure Integration Tests
    Voice Message Payload
      ✓ should create complete voice message payload (XXms)
      ✓ should handle voice message with empty conversation history (XXms)
      ✓ should process voice message without connection context (XXms)
      ✓ should include voice metadata with low confidence score (XXms)
    Call Event Payload
      ✓ should create complete call event payload for incoming call (XXms)
      ✓ should create call event payload for answered call (XXms)
      ✓ should create call event payload for DTMF input (XXms)
      ✓ should create call event payload for hangup (XXms)
      ✓ should handle call event without connection context (XXms)
    Chat Message Payload
      ✓ should create complete chat message payload (XXms)
      ✓ should create chat message with conversation history (XXms)
      ✓ should create chat message without AI context (XXms)
    RAG Context Placeholder
      ✓ should return empty RAG context with fallback message (XXms)
      ✓ should return custom fallback message (XXms)
      ✓ should indicate RAG is not available (XXms)
      ✓ should provide default fallback message (XXms)
    Priority Processing
      ✓ should assign correct priorities to different event types (XXms)
    Error Handling
      ✓ should handle invalid workflow ID gracefully (XXms)
      ✓ should handle missing webhook URL (XXms)
    Connection Context Management
      ✓ should create and retrieve connection context (XXms)
      ✓ should update connection heartbeat (XXms)
    Queue Statistics
      ✓ should retrieve queue statistics (XXms)
      ✓ should check queue health (XXms)

Test Suites: 1 passed, 1 total
Tests:       23 passed, 23 total
Snapshots:   0 total
Time:        X.XXXs

========================================
Test Complete
========================================
```

## Troubleshooting

### ❌ Redis Connection Error
```
Error: Redis connection failed
```
**Fix:** Start Redis
```bash
redis-server
```

### ❌ Test Timeout
```
Error: Timeout - Async callback was not invoked
```
**Fix:** Check Redis latency or increase timeout

### ❌ Module Not Found
```
Error: Cannot find module '@jibu/queue-definitions'
```
**Fix:** Install dependencies
```bash
pnpm install
```

## Alternative Test Commands

### Run Specific Suite
```bash
npx jest apps/backend/src/core/services/__tests__/webhook-payload.integration.spec.ts -t "Voice Message Payload"
```

### Run Single Test
```bash
npx jest apps/backend/src/core/services/__tests__/webhook-payload.integration.spec.ts -t "should create complete voice message payload"
```

### Watch Mode
```bash
npx jest apps/backend/src/core/services/__tests__/webhook-payload.integration.spec.ts --watch
```

### Coverage Report
```bash
npx jest apps/backend/src/core/services/__tests__/webhook-payload.integration.spec.ts --coverage
```

## What's Being Validated

### Payload Structure
✅ Complete conversation context  
✅ Voice metadata (confidence, language, duration)  
✅ Connection context (callSid, startTime)  
✅ Call events (incoming, answered, dtmf, hangup)  
✅ RAG placeholders with fallback messages  

### Priority System
✅ Call events: Priority 10 (highest)  
✅ Voice messages: Priority 5 (medium)  
✅ Chat messages: Priority 1 (lowest)  

### Error Handling
✅ Invalid workflow IDs  
✅ Missing webhook URLs  
✅ Missing connections  
✅ Empty conversation history  

## Next Steps After Tests Pass

1. **Review Payload Structures**
   - Check `TEST_PAYLOAD_EXAMPLES.md` for examples
   - Verify payload format matches n8n expectations

2. **Test with n8n**
   - Send test payload to webhook
   - Verify workflow execution
   - Check payload reception

3. **Production Deployment**
   - Update webhook URLs
   - Configure environment variables
   - Enable monitoring

## Documentation

- **Full Testing Guide:** `PAYLOAD_STRUCTURE_TESTING_GUIDE.md`
- **Payload Examples:** `TEST_PAYLOAD_EXAMPLES.md`
- **Implementation Details:** `PHASE_3_PAYLOAD_STRUCTURE_COMPLETE.md`
- **Summary:** `TESTING_IMPLEMENTATION_SUMMARY.md`

## Support

If tests fail:
1. Check Redis is running
2. Verify dependencies installed
3. Review error messages in output
4. Check `PAYLOAD_STRUCTURE_TESTING_GUIDE.md` troubleshooting section

## Success Indicators

✅ All 23 tests pass  
✅ No warnings or errors  
✅ Test execution completes in <30 seconds  
✅ Queue statistics available  
✅ Connection management working  

---

**Ready to test?** Run: `run-payload-tests.bat`
