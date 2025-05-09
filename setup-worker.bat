@echo off
REM setup-worker.bat
REM Script to set up the worker environment

echo Setting up worker environment...
echo.

REM Set DATABASE_URL environment variable
set DATABASE_URL=postgresql://postgres:postgres@localhost:5432/jibu?schema=public

REM Generate Prisma client
echo [1/4] Generating Prisma client...
call pnpm exec prisma generate --schema=apps/backend/prisma/schema.prisma

REM Run Prisma migrations
echo [2/4] Running database migrations...
cd apps/backend
call pnpm exec prisma migrate deploy --schema=%CD%\prisma\schema.prisma
cd ..
cd ..

REM Start worker
echo [3/4] Starting worker...
call pnpm run worker:start

echo.
echo Worker setup completed! 