-- AlterTable
ALTER TABLE "KnowledgeBaseSource" ADD COLUMN     "hasIndexedContent" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ChunkMetadata" (
    "id" TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "vectorId" TEXT NOT NULL,
    "textPreview" TEXT NOT NULL,
    "textLength" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChunkMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChunkMetadata_knowledgeBaseId_idx" ON "ChunkMetadata"("knowledgeBaseId");

-- CreateIndex
CREATE INDEX "ChunkMetadata_sourceId_idx" ON "ChunkMetadata"("sourceId");

-- CreateIndex
CREATE INDEX "ChunkMetadata_vectorId_idx" ON "ChunkMetadata"("vectorId");

-- AddForeignKey
ALTER TABLE "ChunkMetadata" ADD CONSTRAINT "ChunkMetadata_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "KnowledgeBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChunkMetadata" ADD CONSTRAINT "ChunkMetadata_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "KnowledgeBaseSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
