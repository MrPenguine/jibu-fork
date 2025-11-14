@echo off
echo ========================================
echo Running Webhook Integration Test
echo ========================================
echo.

cd /d "%~dp0"

REM Run the specific test file
call node_modules\.bin\jest apps/backend/src/core/services/__tests__/webhook-integration.test.ts --config=apps/backend/jest.config.js

echo.
echo ========================================
echo Test Complete
echo ========================================
pause
