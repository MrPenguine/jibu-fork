/*
  Warnings:

  - You are about to drop the column `endedAt` on the `AgentSession` table. All the data in the column will be lost.
  - You are about to drop the column `phoneNumber` on the `AgentSession` table. All the data in the column will be lost.
  - You are about to drop the column `agentPrompt` on the `Workflow` table. All the data in the column will be lost.
  - You are about to drop the column `webhookUrl` on the `Workflow` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `WorkflowNode` table. All the data in the column will be lost.
  - You are about to drop the column `n8nNodeId` on the `WorkflowNode` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `WorkflowNode` table. All the data in the column will be lost.
  - You are about to drop the column `positionX` on the `WorkflowNode` table. All the data in the column will be lost.
  - You are about to drop the column `positionY` on the `WorkflowNode` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `WorkflowNode` table. All the data in the column will be lost.
  - The `nodeType` column on the `WorkflowNode` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `WorkflowConnection` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `data` to the `WorkflowNode` table without a default value. This is not possible if the table is not empty.
  - Added the required column `position` to the `WorkflowNode` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `WorkflowNode` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "AgentNodeType" ADD VALUE 'ASSISTANT';

-- DropForeignKey
ALTER TABLE "AgentSession" DROP CONSTRAINT "AgentSession_chatId_fkey";

-- DropForeignKey
ALTER TABLE "WorkflowConnection" DROP CONSTRAINT "WorkflowConnection_sourceNodeId_fkey";

-- DropForeignKey
ALTER TABLE "WorkflowConnection" DROP CONSTRAINT "WorkflowConnection_targetNodeId_fkey";

-- DropForeignKey
ALTER TABLE "WorkflowConnection" DROP CONSTRAINT "WorkflowConnection_workflowId_fkey";

-- DropIndex
DROP INDEX "AgentSession_callSid_idx";

-- DropIndex
DROP INDEX "AgentSession_callSid_key";

-- DropIndex
DROP INDEX "AgentSession_status_idx";

-- DropIndex
DROP INDEX "Workflow_masterWorkflowId_idx";

-- DropIndex
DROP INDEX "Workflow_n8nWorkflowId_idx";

-- DropIndex
DROP INDEX "Workflow_workflowType_idx";

-- DropIndex
DROP INDEX "WorkflowNode_n8nNodeId_idx";

-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "AgentSession" DROP COLUMN "endedAt",
DROP COLUMN "phoneNumber",
ALTER COLUMN "variables" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'active';

-- AlterTable
ALTER TABLE "Workflow" DROP COLUMN "agentPrompt",
DROP COLUMN "webhookUrl",
ADD COLUMN     "isPrimary" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "WorkflowNode" DROP COLUMN "createdAt",
DROP COLUMN "n8nNodeId",
DROP COLUMN "name",
DROP COLUMN "positionX",
DROP COLUMN "positionY",
DROP COLUMN "updatedAt",
ADD COLUMN     "data" JSONB NOT NULL,
ADD COLUMN     "incomingChoiceId" TEXT,
ADD COLUMN     "position" JSONB NOT NULL,
ADD COLUMN     "type" "AgentNodeType" NOT NULL,
DROP COLUMN "nodeType",
ADD COLUMN     "nodeType" "AgentNodeType";

-- DropTable
DROP TABLE "WorkflowConnection";

-- CreateTable
CREATE TABLE "WorkflowEdge" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "sourceHandle" TEXT,
    "targetHandle" TEXT,
    "n8nSourceOutput" TEXT,
    "n8nTargetInput" TEXT,

    CONSTRAINT "WorkflowEdge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkflowEdge_workflowId_idx" ON "WorkflowEdge"("workflowId");

-- CreateIndex
CREATE INDEX "WorkflowEdge_sourceId_idx" ON "WorkflowEdge"("sourceId");

-- CreateIndex
CREATE INDEX "WorkflowEdge_targetId_idx" ON "WorkflowEdge"("targetId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowEdge_sourceId_targetId_key" ON "WorkflowEdge"("sourceId", "targetId");

-- CreateIndex
CREATE INDEX "Assistant_n8nWorkflowId_idx" ON "Assistant"("n8nWorkflowId");

-- AddForeignKey
ALTER TABLE "AgentSession" ADD CONSTRAINT "AgentSession_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowEdge" ADD CONSTRAINT "WorkflowEdge_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowEdge" ADD CONSTRAINT "WorkflowEdge_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "WorkflowNode"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowEdge" ADD CONSTRAINT "WorkflowEdge_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "WorkflowNode"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
