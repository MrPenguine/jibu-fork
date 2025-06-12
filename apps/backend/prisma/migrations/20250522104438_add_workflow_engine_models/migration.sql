-- Create the WorkflowType enum first
CREATE TYPE "WorkflowType" AS ENUM ('MASTER', 'SECONDARY');

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

-- Data migration removed as Agent table doesn't exist yet

-- Secondary workflow update removed as Agent table doesn't exist yet

-- Create indexes
CREATE INDEX "Workflow_agentId_idx" ON "Workflow"("agentId");
CREATE INDEX "Workflow_organizationId_idx" ON "Workflow"("organizationId");
CREATE INDEX "Workflow_workflowType_idx" ON "Workflow"("workflowType");
CREATE INDEX "Workflow_masterWorkflowId_idx" ON "Workflow"("masterWorkflowId");

-- Add relationships
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_masterWorkflowId_fkey" 
  FOREIGN KEY ("masterWorkflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Agent foreign key constraint removed as Agent table doesn't exist yet
-- Will be added in a later migration

ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_organizationId_fkey" 
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
