-- CreateTable
CREATE TABLE "public"."Assistant" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "agentId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "llmProvider" "public"."LlmProvider",
    "llmModel" TEXT,
    "voiceId" TEXT,
    "sttModel" TEXT,
    "hipaaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "systemPrompt" TEXT,
    "metadata" JSONB,

    CONSTRAINT "Assistant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AssistantTool" (
    "id" TEXT NOT NULL,
    "assistantId" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "config" JSONB,

    CONSTRAINT "AssistantTool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AssistantKnowledgeBase" (
    "id" TEXT NOT NULL,
    "assistantId" TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,

    CONSTRAINT "AssistantKnowledgeBase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Assistant_agentId_idx" ON "public"."Assistant"("agentId");

-- CreateIndex
CREATE INDEX "Assistant_workspaceId_idx" ON "public"."Assistant"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Assistant_agentId_name_key" ON "public"."Assistant"("agentId", "name");

-- CreateIndex
CREATE INDEX "AssistantTool_toolId_idx" ON "public"."AssistantTool"("toolId");

-- CreateIndex
CREATE UNIQUE INDEX "AssistantTool_assistantId_toolId_key" ON "public"."AssistantTool"("assistantId", "toolId");

-- CreateIndex
CREATE INDEX "AssistantKnowledgeBase_knowledgeBaseId_idx" ON "public"."AssistantKnowledgeBase"("knowledgeBaseId");

-- CreateIndex
CREATE UNIQUE INDEX "AssistantKnowledgeBase_assistantId_knowledgeBaseId_key" ON "public"."AssistantKnowledgeBase"("assistantId", "knowledgeBaseId");

-- CreateIndex
CREATE INDEX "Workspace_id_idx" ON "public"."Workspace"("id");

-- AddForeignKey
ALTER TABLE "public"."Assistant" ADD CONSTRAINT "Assistant_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "public"."Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Assistant" ADD CONSTRAINT "Assistant_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssistantTool" ADD CONSTRAINT "AssistantTool_assistantId_fkey" FOREIGN KEY ("assistantId") REFERENCES "public"."Assistant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssistantTool" ADD CONSTRAINT "AssistantTool_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "public"."Tool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssistantKnowledgeBase" ADD CONSTRAINT "AssistantKnowledgeBase_assistantId_fkey" FOREIGN KEY ("assistantId") REFERENCES "public"."Assistant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssistantKnowledgeBase" ADD CONSTRAINT "AssistantKnowledgeBase_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "public"."KnowledgeBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
