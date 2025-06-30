-- AlterTable
ALTER TABLE "Workflow" ADD COLUMN     "agentPrompt" TEXT,
ADD COLUMN     "n8nWorkflowId" TEXT,
ADD COLUMN     "webhookUrl" TEXT;

-- CreateTable
CREATE TABLE "WorkflowNode" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workflowId" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parameters" TEXT,
    "positionX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "positionY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "n8nNodeId" TEXT,
    "toolId" TEXT,

    CONSTRAINT "WorkflowNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowConnection" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workflowId" TEXT NOT NULL,
    "sourceNodeId" TEXT NOT NULL,
    "targetNodeId" TEXT NOT NULL,
    "label" TEXT,
    "condition" TEXT,
    "n8nSourceOutput" TEXT,
    "n8nTargetInput" TEXT,

    CONSTRAINT "WorkflowConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkflowNode_workflowId_idx" ON "WorkflowNode"("workflowId");

-- CreateIndex
CREATE INDEX "WorkflowNode_toolId_idx" ON "WorkflowNode"("toolId");

-- CreateIndex
CREATE INDEX "WorkflowNode_n8nNodeId_idx" ON "WorkflowNode"("n8nNodeId");

-- CreateIndex
CREATE INDEX "WorkflowConnection_workflowId_idx" ON "WorkflowConnection"("workflowId");

-- CreateIndex
CREATE INDEX "WorkflowConnection_sourceNodeId_idx" ON "WorkflowConnection"("sourceNodeId");

-- CreateIndex
CREATE INDEX "WorkflowConnection_targetNodeId_idx" ON "WorkflowConnection"("targetNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowConnection_sourceNodeId_targetNodeId_key" ON "WorkflowConnection"("sourceNodeId", "targetNodeId");

-- CreateIndex
CREATE INDEX "Workflow_n8nWorkflowId_idx" ON "Workflow"("n8nWorkflowId");

-- AddForeignKey
ALTER TABLE "WorkflowNode" ADD CONSTRAINT "WorkflowNode_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowNode" ADD CONSTRAINT "WorkflowNode_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowConnection" ADD CONSTRAINT "WorkflowConnection_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowConnection" ADD CONSTRAINT "WorkflowConnection_sourceNodeId_fkey" FOREIGN KEY ("sourceNodeId") REFERENCES "WorkflowNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowConnection" ADD CONSTRAINT "WorkflowConnection_targetNodeId_fkey" FOREIGN KEY ("targetNodeId") REFERENCES "WorkflowNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
