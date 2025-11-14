# 🔗 Webhook Integration Test Guide

This guide explains how to use the webhook integration test to verify real communication with your n8n workflows.

---

## 📋 Overview

The webhook integration test sends **real HTTP requests** to your workflow and webhook URLs to verify:
- ✅ Communication is working
- ✅ Payloads are being received
- ✅ Response times are acceptable
- ✅ Error handling works correctly

**Test File Location:**
```
apps/backend/src/core/services/__tests__/webhook-integration.test.ts
```

---

## 🚀 Quick Start

### Option 1: Use the Batch File (Easiest)

1. **Set your URLs as environment variables:**
   ```cmd
   set TEST_WORKFLOW_URL=https://your-n8n-instance.com/webhook/workflow-id
   set TEST_WEBHOOK_URL=https://your-n8n-instance.com/webhook-test/webhook-id
   ```

2. **Run the test:**
   ```cmd
   test-webhook-communication.bat
   ```

### Option 2: Edit the Test File Directly

1. **Open the test file:**
   ```
   apps/backend/src/core/services/__tests__/webhook-integration.test.ts
   ```

2. **Update the URLs (lines 14-15):**
   ```typescript
   const WORKFLOW_URL = 'https://your-n8n-instance.com/webhook/workflow-id';
   const WEBHOOK_URL = 'https://your-n8n-instance.com/webhook-test/webhook-id';
   ```

3. **Run the test:**
   ```cmd
   npm test -- webhook-integration.test
   ```

### Option 3: Use Environment File

1. **Copy the example file:**
   ```cmd
   copy .env.test.example .env.test
   ```

2. **Edit `.env.test` with your URLs:**
   ```env
   TEST_WORKFLOW_URL=https://your-n8n-instance.com/webhook/workflow-id
   TEST_WEBHOOK_URL=https://your-n8n-instance.com/webhook-test/webhook-id
   ```

3. **Load the environment and run:**
   ```cmd
   # Load environment variables from .env.test
   # Then run the test
   npm test -- webhook-integration.test
   ```

---

## 🧪 What Gets Tested

### 1. **Workflow URL Communication**
- Sends a test payload to your workflow URL
- Verifies successful response (200-299 status code)
- Logs response data

**Test Payload:**
```json
{
  "workflowId": "test-workflow-123",
  "sessionId": "test-session-456",
  "timestamp": "2025-11-13T19:57:00.000Z",
  "event": "test_event",
  "data": {
    "message": "Integration test from Jibu Console",
    "source": "webhook-integration.test.ts"
  }
}
```

### 2. **Webhook URL Communication**
- Sends a test payload to your webhook URL
- Verifies successful response
- Logs response data

**Test Payload:**
```json
{
  "sessionId": "test-session-789",
  "timestamp": "2025-11-13T19:57:00.000Z",
  "event": "webhook_test",
  "payload": {
    "message": "Webhook integration test",
    "isVoice": false,
    "priority": 5
  }
}
```

### 3. **Voice-Priority Request**
- Sends a high-priority voice webhook request
- Measures response time (should be < 5 seconds)
- Verifies voice-specific requirements

**Voice Payload:**
```json
{
  "workflowId": "voice-workflow-123",
  "sessionId": "voice-session-456",
  "connectionId": "conn-789",
  "isVoice": true,
  "priority": 10,
  "event": "call_started",
  "payload": {
    "callSid": "CA1234567890",
    "from": "+1234567890",
    "to": "+0987654321",
    "status": "in-progress"
  }
}
```

### 4. **Error Handling**
- Tests with an invalid URL
- Verifies error handling works correctly

### 5. **Performance Measurement**
- Sends 5 requests to measure response times
- Calculates average, min, and max response times
- Provides performance rating:
  - ⚡ **EXCELLENT**: < 1 second
  - ✅ **GOOD**: < 3 seconds
  - ⚠️ **ACCEPTABLE**: < 5 seconds
  - ❌ **SLOW**: > 5 seconds

---

## 📊 Expected Output

### Successful Test:
```
Webhook Integration Test
  Webhook Communication
    ✓ should successfully send a request to the workflow URL (1234ms)
    📤 Sending request to: https://your-n8n-instance.com/webhook/workflow-id
    ✅ Response received: { status: 200, statusText: 'OK', data: {...} }
    
    ✓ should successfully send a request to the webhook URL (987ms)
    📤 Sending request to: https://your-n8n-instance.com/webhook-test/webhook-id
    ✅ Response received: { status: 200, statusText: 'OK', data: {...} }
    
    ✓ should send a voice-priority webhook request (543ms)
    📤 Sending voice-priority request to: https://your-n8n-instance.com/webhook-test/webhook-id
    ✅ Voice webhook response: { status: 200, duration: '543ms', data: {...} }
    ⚡ Response time: 543ms (EXCELLENT)
    
    ✓ should handle webhook errors gracefully (234ms)
    ✅ Error handling works correctly
    
  Performance Tests
    ✓ should measure webhook response time (5432ms)
    ⏱️  Measuring response time for: https://your-n8n-instance.com/webhook-test/webhook-id
      Request 1/5: 543ms
      Request 2/5: 521ms
      Request 3/5: 567ms
      Request 4/5: 534ms
      Request 5/5: 549ms
    
    📊 Performance Summary:
      Average: 542.80ms
      Min: 521ms
      Max: 567ms
      Successful requests: 5/5
      ⚡ EXCELLENT - Under 1 second

Test Suites: 1 passed, 1 total
Tests:       5 passed, 5 total
```

### Skipped Test (URLs not configured):
```
Webhook Integration Test
  Webhook Communication
    ○ skipped should successfully send a request to the workflow URL
    ⚠️  Skipping test - WORKFLOW_URL not configured
    Set TEST_WORKFLOW_URL environment variable or update the test file
```

---

## 🔧 Configuration Examples

### Example 1: n8n Cloud
```env
TEST_WORKFLOW_URL=https://your-instance.app.n8n.cloud/webhook/abc123
TEST_WEBHOOK_URL=https://your-instance.app.n8n.cloud/webhook-test/xyz789
```

### Example 2: Self-Hosted n8n
```env
TEST_WORKFLOW_URL=https://n8n.yourdomain.com/webhook/workflow-id
TEST_WEBHOOK_URL=https://n8n.yourdomain.com/webhook-test/webhook-id
```

### Example 3: Local Development
```env
TEST_WORKFLOW_URL=http://localhost:5678/webhook/test-workflow
TEST_WEBHOOK_URL=http://localhost:5678/webhook-test/test-webhook
```

---

## 🐛 Troubleshooting

### Issue: "WORKFLOW_URL not configured"

**Solution:**
Set the environment variable or edit the test file:
```cmd
set TEST_WORKFLOW_URL=https://your-url.com
```

### Issue: "Request failed with status 404"

**Possible causes:**
1. ❌ Incorrect URL
2. ❌ Workflow not published in n8n
3. ❌ Webhook node not configured

**Solution:**
- Verify the URL in n8n
- Ensure the workflow is active
- Check the webhook node configuration

### Issue: "Request failed with timeout"

**Possible causes:**
1. ❌ n8n instance is down
2. ❌ Network connectivity issues
3. ❌ Workflow is taking too long to respond

**Solution:**
- Check if n8n is running
- Verify network connectivity
- Increase timeout in the test (currently 10 seconds)

### Issue: "ECONNREFUSED"

**Possible causes:**
1. ❌ n8n is not running
2. ❌ Incorrect host/port
3. ❌ Firewall blocking connection

**Solution:**
- Start n8n: `n8n start`
- Verify the URL is correct
- Check firewall settings

---

## 📝 Customizing the Test

### Add Custom Headers
```typescript
const response = await axios.post(WEBHOOK_URL, testPayload, {
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-token',
    'X-Custom-Header': 'custom-value',
  },
});
```

### Change Timeout
```typescript
const response = await axios.post(WEBHOOK_URL, testPayload, {
  timeout: 15000, // 15 seconds
});
```

### Add More Test Cases
```typescript
it('should send a custom event', async () => {
  const customPayload = {
    event: 'custom_event',
    data: {
      // Your custom data
    },
  };
  
  const response = await axios.post(WEBHOOK_URL, customPayload);
  expect(response.status).toBe(200);
});
```

---

## 🎯 Best Practices

1. **Test in Development First**
   - Use local or development URLs first
   - Verify everything works before testing production

2. **Monitor Response Times**
   - Voice workflows should respond in < 5 seconds
   - Non-voice workflows should respond in < 10 seconds

3. **Check n8n Logs**
   - Monitor n8n execution logs during tests
   - Verify payloads are being received correctly

4. **Use Environment Variables**
   - Don't commit real URLs to version control
   - Use `.env.test` (add to `.gitignore`)

5. **Run Regularly**
   - Run integration tests after deploying changes
   - Include in CI/CD pipeline for automated testing

---

## 🔗 Related Documentation

- **TESTING_GUIDE.md** - Comprehensive testing guide
- **UNIT_TESTS_SUMMARY.md** - Unit test summary
- **IMPLEMENTATION_COMPLETE.md** - Full implementation details

---

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Verify your n8n instance is running and accessible
3. Check n8n logs for errors
4. Review the test output for specific error messages

---

**Last Updated**: 2025-11-13  
**Version**: 1.0.0  
**Status**: ✅ **READY TO USE**
