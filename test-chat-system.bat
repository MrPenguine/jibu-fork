@echo off
echo ========================================
echo Chat System Test Script
echo ========================================
echo.

REM Set test variables
set SESSION_ID=test-session-%RANDOM%
set WORKFLOW_ID=cf769a32-2140-420f-99ed-19abb22ee721
set WORKSPACE_ID=85fb8ec7-e33c-43ce-bc20-7fa0ac55060b
set BASE_URL=http://localhost:3000

echo Session ID: %SESSION_ID%
echo Workflow ID: %WORKFLOW_ID%
echo Workspace ID: %WORKSPACE_ID%
echo.

echo ========================================
echo Test 1: Start Conversation
echo ========================================
curl -X POST %BASE_URL%/api/v1/chat/start ^
  -H "Content-Type: application/json" ^
  -d "{\"sessionId\":\"%SESSION_ID%\",\"workflowId\":\"%WORKFLOW_ID%\",\"workspaceId\":\"%WORKSPACE_ID%\",\"initialContext\":{\"systemPrompt\":\"You are a helpful assistant\",\"systemMessage\":\"Welcome!\"}}"
echo.
echo.

echo ========================================
echo Test 2: Send First Message
echo ========================================
curl -X POST %BASE_URL%/api/v1/chat/message ^
  -H "Content-Type: application/json" ^
  -d "{\"sessionId\":\"%SESSION_ID%\",\"text\":\"Hello, I need help with my order\"}"
echo.
echo.

echo ========================================
echo Test 3: Send Second Message
echo ========================================
curl -X POST %BASE_URL%/api/v1/chat/message ^
  -H "Content-Type: application/json" ^
  -d "{\"sessionId\":\"%SESSION_ID%\",\"text\":\"My order number is 12345\"}"
echo.
echo.

echo ========================================
echo Test 4: Get Conversation History
echo ========================================
curl -X GET "%BASE_URL%/api/v1/chat/history/%SESSION_ID%?limit=10"
echo.
echo.

echo ========================================
echo Test 5: Get Conversation Details
echo ========================================
curl -X GET "%BASE_URL%/api/v1/chat/conversation/%SESSION_ID%"
echo.
echo.

echo ========================================
echo Test 6: Send Voice Message
echo ========================================
curl -X POST %BASE_URL%/api/v1/chat/message ^
  -H "Content-Type: application/json" ^
  -d "{\"sessionId\":\"%SESSION_ID%\",\"text\":\"Hello from voice\",\"isVoice\":true,\"voiceMetadata\":{\"confidence\":0.95,\"language\":\"en-US\",\"duration\":3500}}"
echo.
echo.

echo ========================================
echo Test Complete!
echo ========================================
echo.
echo Session ID used: %SESSION_ID%
echo.
echo To view the conversation history again, run:
echo curl -X GET "%BASE_URL%/api/v1/chat/history/%SESSION_ID%"
echo.

pause
