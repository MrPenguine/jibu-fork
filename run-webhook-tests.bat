@echo off
echo ========================================
echo Webhook URL Foundation - Test Runner
echo ========================================
echo.

:menu
echo Please select test type:
echo 1. Run All Webhook Tests
echo 2. Test Cache Service Only
echo 3. Test Backend Service Only
echo 4. Test Worker Processor Only
echo 5. Run Tests with Coverage
echo 6. Run Tests in Watch Mode
echo 7. Clear Jest Cache
echo 8. Exit
echo.

set /p choice="Enter your choice (1-8): "

if "%choice%"=="1" goto all_tests
if "%choice%"=="2" goto cache_tests
if "%choice%"=="3" goto backend_tests
if "%choice%"=="4" goto worker_tests
if "%choice%"=="5" goto coverage_tests
if "%choice%"=="6" goto watch_tests
if "%choice%"=="7" goto clear_cache
if "%choice%"=="8" goto end

echo Invalid choice. Please try again.
echo.
goto menu

:all_tests
echo.
echo Running all webhook tests...
echo.
npx jest --testPathPattern="webhook" --verbose
goto end_test

:cache_tests
echo.
echo Running cache service tests...
echo.
npx jest libs/cache-utils/src/__tests__/webhook-cache.service.spec.ts --verbose
goto end_test

:backend_tests
echo.
echo Running backend service tests...
echo.
npx jest apps/backend/src/core/webhook/__tests__/webhook-url.service.spec.ts --verbose
goto end_test

:worker_tests
echo.
echo Running worker processor tests...
echo.
npx jest apps/worker/src/n8n/__tests__/publish-workflow.processor.spec.ts --verbose
goto end_test

:coverage_tests
echo.
echo Running tests with coverage...
echo.
npx jest --testPathPattern="webhook" --coverage --verbose
goto end_test

:watch_tests
echo.
echo Running tests in watch mode...
echo Press Ctrl+C to exit watch mode
echo.
npx jest --testPathPattern="webhook" --watch
goto end_test

:clear_cache
echo.
echo Clearing Jest cache...
echo.
npx jest --clearCache
echo Cache cleared successfully!
echo.
pause
goto menu

:end_test
echo.
echo ========================================
echo Test execution completed!
echo ========================================
echo.
pause
goto menu

:end
echo.
echo Exiting test runner...
echo.
