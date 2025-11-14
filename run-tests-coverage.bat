@echo off
echo ========================================
echo Running Tests with Coverage
echo ========================================
echo.

call npm run test:coverage

echo.
echo ========================================
echo Coverage Report Generated
echo ========================================
echo Opening coverage report in browser...
echo.

start coverage\lcov-report\index.html

pause
