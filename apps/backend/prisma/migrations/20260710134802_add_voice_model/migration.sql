/*
  Warnings:

  - You are about to drop the column `n8nWorkflowId` on the `Agent` table. All the data in the column will be lost.
  - You are about to drop the column `primaryWorkflowId` on the `Agent` table. All the data in the column will be lost.
  - You are about to drop the column `nodeType` on the `Chat` table. All the data in the column will be lost.
  - You are about to drop the column `workflowId` on the `Chat` table. All the data in the column will be lost.
  - You are about to drop the `N8nWorkflow` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Webhook` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WebhookInvocation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Workflow` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WorkflowVersion` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Agent" DROP CONSTRAINT "Agent_n8nWorkflowId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Agent" DROP CONSTRAINT "Agent_primaryWorkflowId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Chat" DROP CONSTRAINT "Chat_workflowId_fkey";

-- DropForeignKey
ALTER TABLE "public"."N8nWorkflow" DROP CONSTRAINT "N8nWorkflow_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Webhook" DROP CONSTRAINT "Webhook_workflowId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Webhook" DROP CONSTRAINT "Webhook_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "public"."WebhookInvocation" DROP CONSTRAINT "WebhookInvocation_webhookId_fkey";

-- DropForeignKey
ALTER TABLE "public"."WebhookInvocation" DROP CONSTRAINT "WebhookInvocation_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Workflow" DROP CONSTRAINT "Workflow_agentId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Workflow" DROP CONSTRAINT "Workflow_draftVersionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Workflow" DROP CONSTRAINT "Workflow_n8nWorkflowId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Workflow" DROP CONSTRAINT "Workflow_publishedVersionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Workflow" DROP CONSTRAINT "Workflow_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "public"."WorkflowVersion" DROP CONSTRAINT "WorkflowVersion_workflowId_fkey";

-- DropIndex
DROP INDEX "public"."Agent_primaryWorkflowId_key";

-- DropIndex
DROP INDEX "public"."Chat_workflowId_idx";

-- AlterTable
ALTER TABLE "public"."Agent" DROP COLUMN "n8nWorkflowId",
DROP COLUMN "primaryWorkflowId";

-- AlterTable
ALTER TABLE "public"."Chat" DROP COLUMN "nodeType",
DROP COLUMN "workflowId";

-- DropTable
DROP TABLE "public"."N8nWorkflow";

-- DropTable
DROP TABLE "public"."Webhook";

-- DropTable
DROP TABLE "public"."WebhookInvocation";

-- DropTable
DROP TABLE "public"."Workflow";

-- DropTable
DROP TABLE "public"."WorkflowVersion";

-- DropEnum
DROP TYPE "public"."AgentNodeType";

-- DropEnum
DROP TYPE "public"."N8nWorkflowType";

-- CreateTable
CREATE TABLE "public"."Voice" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "language" TEXT DEFAULT 'en',
    "type" TEXT NOT NULL DEFAULT 'cloned',
    "fileId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Voice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Voice_workspaceId_idx" ON "public"."Voice"("workspaceId");

-- AddForeignKey
ALTER TABLE "public"."Voice" ADD CONSTRAINT "Voice_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Voice" ADD CONSTRAINT "Voice_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "public"."File"("id") ON DELETE SET NULL ON UPDATE CASCADE;
