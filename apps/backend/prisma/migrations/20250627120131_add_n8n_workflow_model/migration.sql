/*
  Warnings:

  - You are about to drop the column `webhookUrl` on the `Assistant` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "n8nWorkflowId" TEXT;

-- AlterTable
ALTER TABLE "Assistant" DROP COLUMN "webhookUrl";

-- CreateTable
CREATE TABLE "N8nWorkflow" (
    "id" TEXT NOT NULL,
    "n8nWorkflowId" TEXT NOT NULL,
    "webhookUrl" TEXT NOT NULL,
    "workflowJson" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "lastValidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "N8nWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "N8nWorkflow_organizationId_idx" ON "N8nWorkflow"("organizationId");

-- AddForeignKey
ALTER TABLE "Assistant" ADD CONSTRAINT "Assistant_n8nWorkflowId_fkey" FOREIGN KEY ("n8nWorkflowId") REFERENCES "N8nWorkflow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "N8nWorkflow" ADD CONSTRAINT "N8nWorkflow_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_n8nWorkflowId_fkey" FOREIGN KEY ("n8nWorkflowId") REFERENCES "N8nWorkflow"("id") ON DELETE SET NULL ON UPDATE CASCADE;
