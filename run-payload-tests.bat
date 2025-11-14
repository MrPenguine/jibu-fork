@echo off
echo ========================================
echo Webhook Payload Structure Integration Test
echo ========================================
echo.
echo Using Webhook URL: http://localhost:5678/webhook/api/n8n/hooks/c3c8482b-e019-483f-b5fa-86ac25fa9889/4
echo Using Workflow URL: http://localhost:5678/workflow/WLEvJsev2IeGThNc
echo.
echo Running integration tests for payload structure...
echo.
npx jest apps/backend/src/core/services/__tests__/webhook-payload.integration.spec.ts --runInBand --verbose --no-cache
echo.
echo ========================================
echo Test Complete
echo ========================================
pause
