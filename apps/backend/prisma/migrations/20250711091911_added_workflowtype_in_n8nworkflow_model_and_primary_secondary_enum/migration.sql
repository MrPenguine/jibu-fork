-- CreateEnum
CREATE TYPE "N8nWorkflowType" AS ENUM ('PRIMARY', 'SECONDARY');

-- AlterTable
ALTER TABLE "N8nWorkflow" ADD COLUMN     "workflowType" "N8nWorkflowType" NOT NULL DEFAULT 'PRIMARY';

-- CreateIndex
CREATE INDEX "N8nWorkflow_workflowType_idx" ON "N8nWorkflow"("workflowType");
