# Chat System Testing - Quick Reference

## 🚀 Quick Start

### 1. Start Services
```bash
# Terminal 1: Backend
cd apps/backend && pnpm start:dev

# Terminal 2: Worker
cd apps/worker && pnpm start:dev

# Terminal 3: Redis
redis-server

# Terminal 4: n8n (if not running)
n8n start
```

### 2. Get Token
```
Login → DevTools → Application → Local Storage → Supabase token
```

### 3. Run Test
```bash
test-chat-initial.bat YOUR_JWT_TOKEN
```

---

## 📋 Manual Test Commands

### Set Variables
```bash
set TOKEN=your_jwt_token
set WORKSPACE_ID=85fb8ec7-e33c-43ce-bc20-7fa0ac55060b
set WORKFLOW_ID=cf769a32-2140-420f-99ed-19abb22ee721
set CHAT_ID=your_chat_id
```

### Create Chat
```bash
curl -X POST http://localhost:4000/api/v1/chats ^
  -H "Authorization: Bearer %TOKEN%" ^
  -H "X-Workspace-ID: %WORKSPACE_ID%" ^
  -H "Content-Type: application/json" ^
  -d "{\"assistantId\":\"%WORKFLOW_ID%\",\"sessionId\":\"test-%RANDOM%\",\"name\":\"Test Chat\"}"
```

### Send Message
```bash
curl -X POST http://localhost:4000/api/v1/chats/%CHAT_ID%/messages ^
  -H "Authorization: Bearer %TOKEN%" ^
  -H "X-Workspace-ID: %WORKSPACE_ID%" ^
  -H "Content-Type: application/json" ^
  -d "{\"content\":\"Hello\",\"role\":\"user\"}"
```

### Get History
```bash
curl http://localhost:4000/api/v1/chats/%CHAT_ID%/messages ^
  -H "Authorization: Bearer %TOKEN%" ^
  -H "X-Workspace-ID: %WORKSPACE_ID%"
```

---

## ✅ Verification Points

### n8n Execution
```
URL: http://localhost:5678/workflow/WLEvJsev2IeGThNc
Click: Executions tab (right side)
Look for: New execution within 5 seconds
```

### Expected Payload
```json
{
  "eventType": "message",
  "sessionId": "test-session-xxx",
  "workflowId": "cf769a32-2140-420f-99ed-19abb22ee721",
  "message": {
    "text": "Hello",
    "role": "user"
  },
  "context": {
    "conversationHistory": [...],
    "ragContext": {
      "results": [],
      "fallbackMessage": "I'm having trouble..."
    }
  }
}
```

### Worker Logs
```
[WebhookDeliveryProcessor] Processing chat message
[WebhookDeliveryProcessor] Delivery successful - Status: 200
```

---

## 🔧 Troubleshooting

### No n8n Execution?
1. Check workflow is ACTIVATED (toggle ON)
2. Verify webhook URL matches
3. Check worker logs for errors
4. Test Redis: `redis-cli ping`

### 401 Unauthorized?
- Get fresh token from browser
- Token expires after 1 hour

### 404 Not Found?
- Verify chat ID is correct
- Check workspace ID matches

### Worker Not Processing?
```bash
# Restart worker
cd apps/worker
pnpm start:dev
```

---

## 📊 Success Checklist

- [ ] Backend running (port 4000)
- [ ] Worker running (processing jobs)
- [ ] Redis running (PONG response)
- [ ] n8n running (workflow activated)
- [ ] Chat created (201 status)
- [ ] Message sent (201 status)
- [ ] n8n execution appeared
- [ ] Payload structure correct
- [ ] Conversation history present
- [ ] No errors in logs

---

## 🎯 Test Workflow

```
1. Create Chat
   ↓
2. Send Message
   ↓
3. Check n8n (5 sec)
   ↓
4. Send 2nd Message
   ↓
5. Check n8n (history)
   ↓
6. Get Chat History
   ↓
7. Verify All ✅
```

---

## 📞 Quick URLs

- **Backend**: http://localhost:4000
- **n8n Workflow**: http://localhost:5678/workflow/WLEvJsev2IeGThNc
- **n8n Executions**: Click "Executions" tab in workflow
- **Webhook URL**: http://localhost:5678/webhook/api/n8n/hooks/c3c8482b-e019-483f-b5fa-86ac25fa9889/4

---

## 🔑 Configuration

```
Workspace ID: 85fb8ec7-e33c-43ce-bc20-7fa0ac55060b
Workflow ID:  cf769a32-2140-420f-99ed-19abb22ee721
```

---

## 📚 Full Documentation

- **Complete Guide**: `CHAT_INITIAL_TESTING_GUIDE.md`
- **Test Script**: `test-chat-initial.bat`
- **Implementation**: `CHAT_SYSTEM_IMPLEMENTATION.md`
- **Frontend API**: `FRONTEND_API_UTILS_GUIDE.md`
