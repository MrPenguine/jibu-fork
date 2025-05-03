@echo off
REM start-services.bat
REM Script to start Docker and Cloudflared tunnel for Jibu Console

echo Starting Docker and Cloudflared for Jibu Console...
echo.

REM Define waiting times (in seconds)
set DOCKER_WAIT=20

REM Start Docker Compose
echo [1/2] Starting Docker Compose...
start "Docker Compose" powershell -NoExit -Command "docker compose up"
echo Waiting %DOCKER_WAIT% seconds for Docker services to initialize...
timeout /t %DOCKER_WAIT% /nobreak >nul

REM Start Cloudflared Tunnel
echo.
echo [2/2] Starting Cloudflared Tunnel...
start "Cloudflared Tunnel" powershell -NoExit -Command "cloudflared tunnel --url http://localhost:4000"

echo.
echo Docker and Cloudflared started successfully!
echo You can now manually start the backend and frontend services.
echo Close each PowerShell window individually to stop the respective service 