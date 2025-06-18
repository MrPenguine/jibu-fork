@echo off
REM Set the DATABASE_URL environment variable
set DATABASE_URL=postgresql://postgres:postgres@localhost:5432/jibu?schema=public

REM Run Prisma migration
echo Running Prisma migration with DATABASE_URL=%DATABASE_URL%
cd apps/backend
echo Current directory: %CD%
dir prisma
pnpm exec prisma migrate deploy --schema=%CD%\prisma\schema.prisma

REM Check if migration was successful
if %ERRORLEVEL% EQU 0 (
    echo Migration completed successfully!
) else (
    echo Migration failed with error code %ERRORLEVEL%
)

pause 