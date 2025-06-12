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

-- Workflow table creation removed - already created in previous migration

-- Workflow indexes removed - already created in previous migration

-- Foreign key constraints removed - already added or will be added in the right order later

-- Now add the Agent foreign key constraint that we removed earlier
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
