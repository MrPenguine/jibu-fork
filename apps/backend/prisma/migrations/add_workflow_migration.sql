-- CreateTable
CREATE TABLE "Workflow" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "nodes" JSONB NOT NULL,
  "edges" JSONB NOT NULL,
  "startNodeId" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "publishedAt" TIMESTAMP(3),
  "workflowType" "WorkflowType" NOT NULL DEFAULT 'MASTER',
  "masterWorkflowId" TEXT,
  "agentId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  
  CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);

-- Copy data from Agent to Workflow
-- This needs to be executed after the schema migration
INSERT INTO "Workflow" (
  "id", "createdAt", "updatedAt", "name", "description", 
  "nodes", "edges", "startNodeId", "version", "isPublished", 
  "publishedAt", "workflowType", "agentId", "organizationId"
)
SELECT 
  uuid_generate_v4(), a."createdAt", a."updatedAt", a."name", a."description",
  a."nodes", a."edges", a."startNodeId", a."version", a."isPublished",
  a."publishedAt", a."workflowType", a."id", a."organizationId"
FROM "Agent" a
WHERE a."nodes" IS NOT NULL AND a."edges" IS NOT NULL;

-- UpdateSecondaryWorkflows
-- Update masterWorkflowId for secondary workflows
UPDATE "Workflow" w
SET "masterWorkflowId" = (
  SELECT w2."id"
  FROM "Workflow" w2
  JOIN "Agent" a ON w2."agentId" = a."id"
  WHERE a."id" = (
    SELECT a2."masterAgentId"
    FROM "Agent" a2
    WHERE a2."id" = w."agentId"
  )
  LIMIT 1
)
WHERE w."workflowType" = 'SECONDARY';

-- Create indexes
CREATE INDEX "Workflow_agentId_idx" ON "Workflow"("agentId");
CREATE INDEX "Workflow_organizationId_idx" ON "Workflow"("organizationId");
CREATE INDEX "Workflow_workflowType_idx" ON "Workflow"("workflowType");
CREATE INDEX "Workflow_masterWorkflowId_idx" ON "Workflow"("masterWorkflowId");

-- Add relationships
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_masterWorkflowId_fkey" 
  FOREIGN KEY ("masterWorkflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_agentId_fkey" 
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_organizationId_fkey" 
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
