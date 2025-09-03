/*
  Warnings:

  - A unique constraint covering the columns `[n8nWorkflowId]` on the table `N8nWorkflow` will be added. If there are existing duplicate values, this will fail.
  - Made the column `lastValidatedAt` on table `N8nWorkflow` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "N8nWorkflow" ALTER COLUMN "webhookUrl" DROP NOT NULL,
ALTER COLUMN "workflowJson" DROP NOT NULL,
ALTER COLUMN "lastValidatedAt" SET NOT NULL,
ALTER COLUMN "lastValidatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "N8nWorkflow_n8nWorkflowId_key" ON "N8nWorkflow"("n8nWorkflowId");

-- CreateIndex
CREATE INDEX "N8nWorkflow_n8nWorkflowId_idx" ON "N8nWorkflow"("n8nWorkflowId");

-- CreateIndex
CREATE INDEX "N8nWorkflow_isActive_idx" ON "N8nWorkflow"("isActive");
