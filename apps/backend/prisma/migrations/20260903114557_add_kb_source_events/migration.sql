-- AlterTable
ALTER TABLE "public"."KnowledgeBaseSource" ADD COLUMN     "chunkCount" INTEGER,
ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "progress" INTEGER;

-- CreateTable
CREATE TABLE "public"."KnowledgeBaseSourceEvent" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "message" TEXT NOT NULL,
    "progress" INTEGER,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeBaseSourceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KnowledgeBaseSourceEvent_sourceId_createdAt_idx" ON "public"."KnowledgeBaseSourceEvent"("sourceId", "createdAt");

-- CreateIndex
CREATE INDEX "KnowledgeBaseSourceEvent_workspaceId_createdAt_idx" ON "public"."KnowledgeBaseSourceEvent"("workspaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."KnowledgeBaseSourceEvent" ADD CONSTRAINT "KnowledgeBaseSourceEvent_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "public"."KnowledgeBaseSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
