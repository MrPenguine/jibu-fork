# Workflow Publish Diagnostics Guide

## Problem
Workflows are not being created in n8n, even though they were working before. This diagnostic suite helps trace the full workflow publish flow from backend to worker to n8n.

## Diagnostic Enhancements Added

### 1. Backend Queue Service (`apps/backend/src/core/queue/queue.service.ts`)
**Enhanced logging in `addPublishWorkflowJob` method:**
- ✅ Logs when attempting to enqueue a publish job
- ✅ Logs job data and options
- ✅ Checks and logs queue health (isReady status)
- ✅ Logs successful job creation with Job ID
- ✅ Logs failures with full error details

**Look for these log patterns:**
```
[DIAGNOSTIC] Attempting to enqueue publish job for workflow: <workflowId>
[DIAGNOSTIC] Publish queue ready status: true/false
[DIAGNOSTIC] ✅ Successfully added publish job. Job ID: <jobId>
[DIAGNOSTIC] ❌ Failed to add publish job for workflow <workflowId>
```

### 2. Backend Workflow Controller (`apps/backend/src/modules/v1/workflow/controllers/workflow.controller.ts`)
**Enhanced logging in `publishWorkflow` endpoint:**
- ✅ Logs start of publish operation
- ✅ Step 1: Publishing workflow version
- ✅ Step 2: Compiling and persisting to N8nWorkflow
- ✅ Step 3: Enqueueing publish job to worker
- ✅ Logs success/failure at each step

**Look for these log patterns:**
```
[DIAGNOSTIC] 🚀 Starting publish workflow for ID: <workflowId>
[DIAGNOSTIC] Step 1: Publishing workflow version...
[DIAGNOSTIC] ✅ Step 1 complete
[DIAGNOSTIC] Step 2: Compiling and persisting to N8nWorkflow...
[DIAGNOSTIC] ✅ Step 2 complete: Compiled. N8nWorkflowDbId: <id>, Hash: <hash>
[DIAGNOSTIC] Step 3: Enqueueing publish job to worker...
[DIAGNOSTIC] ✅ Step 3 complete: Job enqueued with ID: <jobId>
[DIAGNOSTIC] 🎉 Publish workflow completed successfully
```

### 3. Worker Publish Processor (`apps/worker/src/n8n/publish-workflow.processor.ts`)
**Comprehensive diagnostics:**
- ✅ Logs on module initialization (confirms processor registration)
- ✅ Queue lifecycle hooks (onActive, onCompleted, onFailed)
- ✅ Step-by-step logging through the entire publish flow
- ✅ Detailed error handling at each step

**Look for these log patterns:**
```
[DIAGNOSTIC] 🎯 PublishWorkflowProcessor initialized and registered for queue: workflow-publish
[DIAGNOSTIC] 📋 Listening for job: publish-workflow
[DIAGNOSTIC] ⚡ Job <jobId> is now active - Processing workflow <workflowId>
[DIAGNOSTIC] 🔄 Starting to process publish job <jobId>
[DIAGNOSTIC] Step 1: Loading workflow from database...
[DIAGNOSTIC] Step 2: Loading N8nWorkflow row...
[DIAGNOSTIC] Step 4: Checking if workflow exists in n8n...
[DIAGNOSTIC] Step 5: Checking for existing workflow by name in n8n...
[DIAGNOSTIC] Step 6: Handling activation...
[DIAGNOSTIC] Step 7: Persisting final status to database...
[DIAGNOSTIC] 🎉 Publish completed successfully!
[DIAGNOSTIC] ✅ Job <jobId> completed successfully
```

### 4. Queue Monitoring Endpoints (NEW)
**Location:** `apps/backend/src/core/queue/queue-monitor.controller.ts`

#### Endpoint 1: Queue Status
**URL:** `GET http://localhost:4000/api/queue/monitor/status`

Shows health and counts for all queues:
```json
{
  "timestamp": "2025-11-12T10:00:00.000Z",
  "queues": {
    "default": {
      "name": "default",
      "healthy": true,
      "counts": {
        "waiting": 0,
        "active": 0,
        "completed": 10,
        "failed": 0,
        "delayed": 0
      }
    },
    "workflow-publish": {
      "name": "workflow-publish",
      "healthy": true,
      "counts": {
        "waiting": 2,
        "active": 1,
        "completed": 5,
        "failed": 1,
        "delayed": 0
      }
    }
  }
}
```

#### Endpoint 2: Publish Queue Jobs
**URL:** `GET http://localhost:4000/api/queue/monitor/publish-queue/jobs`

Shows recent jobs (waiting, active, completed, failed):
```json
{
  "timestamp": "2025-11-12T10:00:00.000Z",
  "waiting": [],
  "active": [{
    "id": "123",
    "data": {
      "workflowId": "abc-123",
      "workspaceId": "workspace-456",
      "activate": true
    },
    "timestamp": 1699776000000,
    "attemptsMade": 0
  }],
  "completed": [],
  "failed": []
}
```

## Troubleshooting Steps

### Step 1: Restart Both Services
1. Stop the backend: `Ctrl+C` in backend terminal
2. Stop the worker: `Ctrl+C` in worker terminal  
3. Start backend: `pnpm nx run backend:dev`
4. Start worker: `pnpm nx run worker:worker`

### Step 2: Check Worker Initialization
**In the worker terminal**, look for:
```
[DIAGNOSTIC] 🎯 PublishWorkflowProcessor initialized and registered for queue: workflow-publish
[DIAGNOSTIC] 📋 Listening for job: publish-workflow
```

**If you DON'T see this:**
- The processor is not registering
- Check `apps/worker/src/n8n/n8n.module.ts` includes `PublishWorkflowProcessor`
- Check `apps/worker/src/app.module.ts` includes `N8nModule`

### Step 3: Check Queue Health
**Call the monitoring endpoint:**
```bash
curl http://localhost:4000/api/queue/monitor/status
```

**Check:**
- Is `workflow-publish.healthy` = `true`?
- Are there jobs stuck in `waiting` or `active`?
- Are there jobs in `failed`?

### Step 4: Trigger a Publish
1. Go to your workflow in the UI
2. Click "Publish"
3. Watch BOTH terminals

**In Backend Terminal, you should see:**
```
[DIAGNOSTIC] 🚀 Starting publish workflow for ID: <workflowId>
[DIAGNOSTIC] Step 1: Publishing workflow version...
[DIAGNOSTIC] ✅ Step 1 complete
[DIAGNOSTIC] Step 2: Compiling and persisting...
[DIAGNOSTIC] ✅ Step 2 complete
[DIAGNOSTIC] Step 3: Enqueueing publish job to worker...
[DIAGNOSTIC] ✅ Step 3 complete: Job enqueued with ID: <jobId>
```

**If backend logs stop after Step 3:**
- Job was successfully enqueued
- Problem is in worker picking up the job

**In Worker Terminal, you should see:**
```
[DIAGNOSTIC] ⚡ Job <jobId> is now active - Processing workflow <workflowId>
[DIAGNOSTIC] 🔄 Starting to process publish job <jobId>
[DIAGNOSTIC] Step 1: Loading workflow from database...
...
[DIAGNOSTIC] 🎉 Publish completed successfully!
```

**If worker shows NO logs:**
- Worker is not picking up jobs from Redis
- Check Redis connection in worker
- Check queue name matches between backend and worker

### Step 5: Check for Stuck Jobs
**Call:**
```bash
curl http://localhost:4000/api/queue/monitor/publish-queue/jobs
```

**If jobs are stuck in `waiting`:**
- Worker is connected but not processing
- Check worker concurrency settings
- Check for errors in worker startup

**If jobs are in `failed`:**
- Look at `failedReason` field
- Check worker logs for error details
- Common issues:
  - Database connection failed
  - n8n API not reachable
  - Missing credentials

### Step 6: Common Issues

#### Issue: Queue not healthy
**Symptoms:** `healthy: false` in monitoring endpoint

**Solutions:**
1. Check Redis is running: `redis-cli ping` should return `PONG`
2. Check Redis connection settings in `.env`:
   ```
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=
   ```
3. Restart services

#### Issue: Worker not picking up jobs
**Symptoms:** Jobs stuck in `waiting`, no worker logs

**Solutions:**
1. Verify worker is running: `pnpm nx run worker:worker`
2. Check worker logs for initialization message
3. Verify queue names match:
   - Backend uses: `QUEUE_NAMES.WORKFLOW_PUBLISH` = `'workflow-publish'`
   - Worker listens to: `@Processor(QUEUE_NAMES.WORKFLOW_PUBLISH)`
4. Check Redis connection in worker

#### Issue: n8n API errors
**Symptoms:** Worker logs show errors connecting to n8n

**Solutions:**
1. Check n8n is running: `http://localhost:5678`
2. Check `.env` settings:
   ```
   N8N_API_URL=http://localhost:5678/api/v1
   N8N_API_KEY=<your-api-key>
   N8N_WEBHOOK_URL=http://localhost:5678
   ```
3. Verify API key is valid

#### Issue: Database errors
**Symptoms:** Worker logs show Prisma errors

**Solutions:**
1. Check database is running
2. Verify connection string in `.env`
3. Run migrations: `pnpm nx run backend:prisma:migrate`

## What to Report

If the issue persists, gather these logs and share them:

1. **Backend terminal output** when publishing a workflow
2. **Worker terminal output** during the same timeframe
3. **Queue monitoring output:**
   ```bash
   curl http://localhost:4000/api/queue/monitor/status
   curl http://localhost:4000/api/queue/monitor/publish-queue/jobs
   ```
4. **Environment variables** (sanitize secrets):
   - `REDIS_HOST`, `REDIS_PORT`
   - `N8N_API_URL`
   - Database connection status

## Next Steps

With these diagnostics in place, you can:
1. ✅ Trace exactly where the flow breaks
2. ✅ See if jobs are being enqueued
3. ✅ See if worker picks up jobs
4. ✅ See if n8n API calls succeed
5. ✅ Identify failed jobs and reasons

The `[DIAGNOSTIC]` prefix makes it easy to grep logs:
```bash
# In backend logs
grep "\[DIAGNOSTIC\]" backend.log

# In worker logs  
grep "\[DIAGNOSTIC\]" worker.log
```
