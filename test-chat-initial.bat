@echo off
REM Chat System Initial Testing Script
REM Tests basic message-only chat flow: API -> Worker -> Webhook -> n8n

echo ========================================
echo Chat System Initial Testing
echo ========================================
echo.

REM Configuration
set BASE_URL=http://localhost:4000
set WORKSPACE_ID=85fb8ec7-e33c-43ce-bc20-7fa0ac55060b
set WORKFLOW_ID=cf769a32-2140-420f-99ed-19abb22ee721

REM Check if token is provided
if "%1"=="" (
    echo ERROR: JWT token required
    echo Usage: test-chat-initial.bat YOUR_JWT_TOKEN
    echo.
    echo To get your token:
    echo 1. Login to the frontend
    echo 2. Open DevTools ^> Application ^> Local Storage
    echo 3. Find Supabase session token
    exit /b 1
)

set TOKEN=%1

echo Configuration:
echo - Base URL: %BASE_URL%
echo - Workspace ID: %WORKSPACE_ID%
echo - Workflow ID: %WORKFLOW_ID%
echo - Token: %TOKEN:~0,20%...
echo.

REM Generate unique session ID
set SESSION_ID=test-session-%RANDOM%%RANDOM%

echo ========================================
echo Step 1: Create Chat
echo ========================================
echo.

curl -X POST %BASE_URL%/api/v1/chats ^
  -H "Authorization: Bearer %TOKEN%" ^
  -H "X-Workspace-ID: %WORKSPACE_ID%" ^
  -H "Content-Type: application/json" ^
  -d "{\"assistantId\":\"%WORKFLOW_ID%\",\"sessionId\":\"%SESSION_ID%\",\"sessionType\":\"chat\",\"name\":\"Initial Test Chat\"}" ^
  -w "\n\nHTTP Status: %%{http_code}\n" ^
  -o chat-response.json

echo.
echo Response saved to: chat-response.json
echo.

REM Extract chat ID from response (requires jq or manual input)
echo Please check chat-response.json for the chat ID
echo.
set /p CHAT_ID="Enter the chat ID from the response: "

if "%CHAT_ID%"=="" (
    echo ERROR: Chat ID is required to continue
    exit /b 1
)

echo.
echo Using Chat ID: %CHAT_ID%
echo.

echo ========================================
echo Step 2: Send First Message
echo ========================================
echo.

curl -X POST %BASE_URL%/api/v1/chats/%CHAT_ID%/messages ^
  -H "Authorization: Bearer %TOKEN%" ^
  -H "X-Workspace-ID: %WORKSPACE_ID%" ^
  -H "Content-Type: application/json" ^
  -d "{\"content\":\"Hello, this is a test message from the chat system\",\"role\":\"user\",\"type\":\"text\"}" ^
  -w "\n\nHTTP Status: %%{http_code}\n"

echo.
echo ========================================
echo Step 3: Wait for Webhook Delivery
echo ========================================
echo.
echo Waiting 5 seconds for webhook to be delivered...
timeout /t 5 /nobreak > nul
echo.

echo Please check n8n Executions:
echo URL: http://localhost:5678/workflow/WLEvJsev2IeGThNc
echo.
echo Look for:
echo - New execution within last 10 seconds
echo - Payload with eventType: "message"
echo - conversationHistory with your message
echo - ragContext with placeholder
echo.

pause

echo ========================================
echo Step 4: Send Second Message
echo ========================================
echo.

curl -X POST %BASE_URL%/api/v1/chats/%CHAT_ID%/messages ^
  -H "Authorization: Bearer %TOKEN%" ^
  -H "X-Workspace-ID: %WORKSPACE_ID%" ^
  -H "Content-Type: application/json" ^
  -d "{\"content\":\"This is my second message to test conversation history\",\"role\":\"user\",\"type\":\"text\"}" ^
  -w "\n\nHTTP Status: %%{http_code}\n"

echo.
echo Waiting 5 seconds for webhook delivery...
timeout /t 5 /nobreak > nul
echo.

echo Check n8n again - conversationHistory should now have 2 messages
echo.

pause

echo ========================================
echo Step 5: Get Chat History
echo ========================================
echo.

curl -X GET "%BASE_URL%/api/v1/chats/%CHAT_ID%/messages" ^
  -H "Authorization: Bearer %TOKEN%" ^
  -H "X-Workspace-ID: %WORKSPACE_ID%" ^
  -w "\n\nHTTP Status: %%{http_code}\n"

echo.
echo ========================================
echo Test Complete!
echo ========================================
echo.
echo Verification Checklist:
echo [ ] Chat created successfully (201 status)
echo [ ] First message sent (201 status)
echo [ ] Second message sent (201 status)
echo [ ] n8n executions appeared (2 total)
echo [ ] Payload structure correct
echo [ ] Conversation history updated
echo [ ] Chat history retrieved
echo.
echo Check the following:
echo 1. n8n Executions: http://localhost:5678/workflow/WLEvJsev2IeGThNc
echo 2. Worker logs for webhook delivery
echo 3. Backend logs for API requests
echo.

pause
