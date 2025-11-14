@echo off
echo ========================================
echo Webhook Communication Integration Test
echo ========================================
echo.
echo This test will send real HTTP requests to verify webhook communication.
echo.
echo CONFIGURATION:
echo --------------
echo You can configure URLs in two ways:
echo.
echo 1. Set environment variables:
echo    set TEST_WORKFLOW_URL=https://your-workflow-url.com
echo    set TEST_WEBHOOK_URL=https://your-webhook-url.com
echo.
echo 2. Edit the test file directly:
echo    apps\backend\src\core\services\__tests__\webhook-integration.test.ts
echo.
echo ========================================
echo.

REM Check if URLs are set
if "%TEST_WORKFLOW_URL%"=="" (
    echo WARNING: TEST_WORKFLOW_URL not set
    echo The workflow URL test will be skipped
    echo.
)

if "%TEST_WEBHOOK_URL%"=="" (
    echo WARNING: TEST_WEBHOOK_URL not set
    echo The webhook URL test will be skipped
    echo.
)

echo Press any key to run the integration test...
pause > nul
echo.

REM Run the integration test
call npm test -- webhook-integration.test

echo.
echo ========================================
echo Test Complete
echo ========================================
pause
