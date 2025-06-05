-- CreateEnum
CREATE TYPE "WorkflowType" AS ENUM ('MASTER', 'SECONDARY');

-- AlterEnum
ALTER TYPE "AgentNodeType" ADD VALUE 'WORKFLOW_CALL';

-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "masterAgentId" TEXT,
ADD COLUMN     "workflowType" "WorkflowType" NOT NULL DEFAULT 'MASTER';

-- CreateIndex
CREATE INDEX "Agent_workflowType_idx" ON "Agent"("workflowType");

-- CreateIndex
CREATE INDEX "Agent_masterAgentId_idx" ON "Agent"("masterAgentId");

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_masterAgentId_fkey" FOREIGN KEY ("masterAgentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
