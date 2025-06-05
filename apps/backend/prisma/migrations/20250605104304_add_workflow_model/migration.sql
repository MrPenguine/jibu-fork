/*
  Warnings:

  - You are about to drop the column `edges` on the `Agent` table. All the data in the column will be lost.
  - You are about to drop the column `isPublished` on the `Agent` table. All the data in the column will be lost.
  - You are about to drop the column `masterAgentId` on the `Agent` table. All the data in the column will be lost.
  - You are about to drop the column `nodes` on the `Agent` table. All the data in the column will be lost.
  - You are about to drop the column `publishedAt` on the `Agent` table. All the data in the column will be lost.
  - You are about to drop the column `startNodeId` on the `Agent` table. All the data in the column will be lost.
  - You are about to drop the column `version` on the `Agent` table. All the data in the column will be lost.
  - You are about to drop the column `workflowType` on the `Agent` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Agent" DROP CONSTRAINT "Agent_masterAgentId_fkey";

-- DropIndex
DROP INDEX "Agent_masterAgentId_idx";

-- DropIndex
DROP INDEX "Agent_workflowType_idx";

-- AlterTable
ALTER TABLE "Agent" DROP COLUMN "edges",
DROP COLUMN "isPublished",
DROP COLUMN "masterAgentId",
DROP COLUMN "nodes",
DROP COLUMN "publishedAt",
DROP COLUMN "startNodeId",
DROP COLUMN "version",
DROP COLUMN "workflowType";

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

-- CreateIndex
CREATE INDEX "Workflow_agentId_idx" ON "Workflow"("agentId");

-- CreateIndex
CREATE INDEX "Workflow_organizationId_idx" ON "Workflow"("organizationId");

-- CreateIndex
CREATE INDEX "Workflow_workflowType_idx" ON "Workflow"("workflowType");

-- CreateIndex
CREATE INDEX "Workflow_masterWorkflowId_idx" ON "Workflow"("masterWorkflowId");

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_masterWorkflowId_fkey" FOREIGN KEY ("masterWorkflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
