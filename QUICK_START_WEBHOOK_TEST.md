# 🚀 Quick Start: Test Webhook Communication

## ⚡ 3 Steps to Test Your Webhooks

### Step 1: Set Your URLs

Open a command prompt and set your webhook URLs:

```cmd
set TEST_WORKFLOW_URL=https://your-n8n-instance.com/webhook/your-workflow-id
set TEST_WEBHOOK_URL=https://your-n8n-instance.com/webhook-test/your-webhook-id
```

**Replace with your actual URLs from n8n!**

---

### Step 2: Run the Test

```cmd
test-webhook-communication.bat
```

Or directly:

```cmd
npm test -- webhook-integration.test
```

---

### Step 3: Check Results

You should see:

```
✅ Response received: { status: 200, ... }
⚡ Response time: 543ms (EXCELLENT)
📊 Performance Summary: Average: 542ms
```

---

## 📍 Where to Find Your URLs

### In n8n:

1. **Open your workflow** in n8n
2. **Find the Webhook node**
3. **Copy the webhook URL** (looks like: `https://your-instance.com/webhook/abc123`)

### Example URLs:

```
Workflow URL:
https://n8n.example.com/webhook/my-workflow-id

Webhook URL:
https://n8n.example.com/webhook-test/my-webhook-id
```

---

## ✅ What Gets Tested

- ✅ **Connection** - Can we reach your webhook?
- ✅ **Response** - Does it respond successfully?
- ✅ **Speed** - Is it fast enough for voice? (< 5 seconds)
- ✅ **Reliability** - Does it handle errors correctly?

---

## 🎯 Expected Results

### ✅ Success:
```
Test Suites: 1 passed
Tests:       5 passed
⚡ EXCELLENT - Under 1 second
```

### ❌ If URLs Not Set:
```
⚠️  Skipping test - WEBHOOK_URL not configured
```
**Solution:** Set the environment variables (Step 1)

### ❌ If Connection Fails:
```
❌ Request failed: ECONNREFUSED
```
**Solution:** Check if n8n is running and URL is correct

---

## 📚 Need More Help?

See the full guide: **WEBHOOK_INTEGRATION_TEST_GUIDE.md**

---

**Ready to test? Run:** `test-webhook-communication.bat`
