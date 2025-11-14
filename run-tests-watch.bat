@echo off
echo ========================================
echo Running Tests in Watch Mode
echo ========================================
echo.
echo Tests will re-run automatically when files change
echo Press Ctrl+C to stop
echo.

call npm run test:watch
