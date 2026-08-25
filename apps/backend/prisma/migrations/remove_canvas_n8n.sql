-- =============================================================
-- Canvas + n8n Removal — Destructive Migration
-- Run this against your database AFTER deploying the new code.
-- =============================================================

-- 1. Drop Chat foreign key and columns (workflowId, nodeType)
ALTER TABLE "Chat" DROP COLUMN IF EXISTS "workflowId";
ALTER TABLE "Chat" DROP COLUMN IF EXISTS "nodeType";

-- 2. Drop Agent foreign key columns (n8nWorkflowId, primaryWorkflowId, workflows)
ALTER TABLE "Agent" DROP COLUMN IF EXISTS "n8nWorkflowId";
ALTER TABLE "Agent" DROP COLUMN IF EXISTS "primaryWorkflowId";

-- 3. Drop the canvas versioning tables (must drop FK-holders first)
DROP TABLE IF EXISTS "WorkflowVersion" CASCADE;

-- 4. Drop the main Workflow table
DROP TABLE IF EXISTS "Workflow" CASCADE;

-- 5. Drop the n8n tables
DROP TABLE IF EXISTS "WebhookInvocation" CASCADE;
DROP TABLE IF EXISTS "Webhook" CASCADE;
DROP TABLE IF EXISTS "N8nWorkflow" CASCADE;

-- 6. Drop enums
DROP TYPE IF EXISTS "AgentNodeType";
DROP TYPE IF EXISTS "N8nWorkflowType";

-- =============================================================
-- Verification (run after migration):
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name IN ('Workflow','WorkflowVersion','N8nWorkflow','Webhook','WebhookInvocation');
-- Should return 0 rows.
-- =============================================================
