-- CreateTable
CREATE TABLE "public"."AgentTool" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "config" JSONB,

    CONSTRAINT "AgentTool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AgentKnowledgeBase" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,

    CONSTRAINT "AgentKnowledgeBase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentTool_toolId_idx" ON "public"."AgentTool"("toolId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentTool_agentId_toolId_key" ON "public"."AgentTool"("agentId", "toolId");

-- CreateIndex
CREATE INDEX "AgentKnowledgeBase_knowledgeBaseId_idx" ON "public"."AgentKnowledgeBase"("knowledgeBaseId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentKnowledgeBase_agentId_knowledgeBaseId_key" ON "public"."AgentKnowledgeBase"("agentId", "knowledgeBaseId");

-- AddForeignKey
ALTER TABLE "public"."AgentTool" ADD CONSTRAINT "AgentTool_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "public"."Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AgentTool" ADD CONSTRAINT "AgentTool_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "public"."Tool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AgentKnowledgeBase" ADD CONSTRAINT "AgentKnowledgeBase_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "public"."Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AgentKnowledgeBase" ADD CONSTRAINT "AgentKnowledgeBase_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "public"."KnowledgeBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
