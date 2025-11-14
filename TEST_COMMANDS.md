# Webhook URL Foundation - Test Commands

## Prerequisites

Ensure you have all dependencies installed:
```cmd
pnpm install
```

## Unit Tests

### 1. Test Shared Cache Service (libs/cache-utils)

```cmd
cd c:\Users\Administrator\Documents\jibu-console
npx jest libs/cache-utils/src/__tests__/webhook-cache.service.spec.ts --verbose
```

### 2. Test Backend Webhook URL Service

```cmd
cd c:\Users\Administrator\Documents\jibu-console
npx jest apps/backend/src/core/webhook/__tests__/webhook-url.service.spec.ts --verbose
```

### 3. Test Worker Publish Processor

```cmd
cd c:\Users\Administrator\Documents\jibu-console
npx jest apps/worker/src/n8n/__tests__/publish-workflow.processor.spec.ts --verbose
```

### 4. Run All Tests Together

```cmd
cd c:\Users\Administrator\Documents\jibu-console
npx jest --testPathPattern="webhook" --verbose
```

### 5. Run Tests with Coverage

```cmd
cd c:\Users\Administrator\Documents\jibu-console
npx jest --testPathPattern="webhook" --coverage --verbose
```

## Manual Testing

### 1. Start Required Services

**Terminal 1 - Start Redis:**
```cmd
cd c:\Users\Administrator\Documents\jibu-console
docker-compose up redis
```

**Terminal 2 - Start PostgreSQL:**
```cmd
cd c:\Users\Administrator\Documents\jibu-console
docker-compose up postgres
```

**Terminal 3 - Start n8n:**
```cmd
cd c:\Users\Administrator\Documents\jibu-console
docker-compose up n8n
```

**Terminal 4 - Start Backend:**
```cmd
cd c:\Users\Administrator\Documents\jibu-console
npm run start:backend
```

**Terminal 5 - Start Worker:**
```cmd
cd c:\Users\Administrator\Documents\jibu-console
npm run start:worker
```

### 2. Test Webhook URL Retrieval

```cmd
curl -X GET http://localhost:4000/api/v1/workflows/YOUR_WORKFLOW_ID/webhook-url ^
  -H "Authorization: Bearer YOUR_TOKEN" ^
  -H "X-Workspace-ID: YOUR_WORKSPACE_ID"
```

### 3. Test Workflow Publish (Triggers Cache Invalidation)

```cmd
curl -X POST http://localhost:4000/api/v1/workflows/YOUR_WORKFLOW_ID/publish ^
  -H "Authorization: Bearer YOUR_TOKEN" ^
  -H "X-Workspace-ID: YOUR_WORKSPACE_ID" ^
  -H "Content-Type: application/json" ^
  -d "{\"activate\": true}"
```

### 4. Check Cache Metrics

```cmd
curl -X GET http://localhost:4000/api/v1/webhook/cache/metrics ^
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Watch Mode (Development)

Run tests in watch mode for active development:

```cmd
cd c:\Users\Administrator\Documents\jibu-console
npx jest --testPathPattern="webhook" --watch
```

## Debugging Tests

Run tests with Node debugger:

```cmd
cd c:\Users\Administrator\Documents\jibu-console
node --inspect-brk node_modules/.bin/jest --testPathPattern="webhook" --runInBand
```

Then open Chrome and navigate to `chrome://inspect`

## Performance Testing

### Quick Performance Test

```cmd
cd c:\Users\Administrator\Documents\jibu-console
node -e "const service = require('./apps/backend/src/core/webhook/webhook-url.service'); console.log('Performance test placeholder');"
```

## Continuous Integration

### Run All Tests (CI Mode)

```cmd
cd c:\Users\Administrator\Documents\jibu-console
npx jest --testPathPattern="webhook" --ci --coverage --maxWorkers=2
```

## Troubleshooting

### Clear Jest Cache

```cmd
cd c:\Users\Administrator\Documents\jibu-console
npx jest --clearCache
```

### Run Single Test File

```cmd
cd c:\Users\Administrator\Documents\jibu-console
npx jest libs/cache-utils/src/__tests__/webhook-cache.service.spec.ts --testNamePattern="should get from memory cache"
```

### Check Test Configuration

```cmd
cd c:\Users\Administrator\Documents\jibu-console
npx jest --showConfig
```

## Expected Test Results

### Cache Service Tests
- ✅ Memory cache hit for voice workflows
- ✅ Redis fallback on memory miss
- ✅ Cache invalidation
- ✅ Circuit breaker triggering
- ✅ LRU eviction
- ✅ Metrics tracking

### Backend Service Tests
- ✅ Cached URL retrieval
- ✅ Database fallback on cache miss
- ✅ Webhook URL refresh from n8n
- ✅ Voice workflow detection
- ✅ Base URL resolution
- ✅ Batch refresh

### Worker Processor Tests
- ✅ Cache invalidation after publish
- ✅ Voice workflow handling with delay
- ✅ Non-voice workflow handling
- ✅ Workflows without webhook nodes

## Quick Test Summary

Run this command to get a quick overview:

```cmd
cd c:\Users\Administrator\Documents\jibu-console && npx jest --testPathPattern="webhook" --verbose --passWithNoTests
```

## Notes

- Replace `YOUR_WORKFLOW_ID`, `YOUR_TOKEN`, and `YOUR_WORKSPACE_ID` with actual values
- Ensure all environment variables are set in `.env` files
- Redis and PostgreSQL must be running for integration tests
- n8n must be running for end-to-end tests
