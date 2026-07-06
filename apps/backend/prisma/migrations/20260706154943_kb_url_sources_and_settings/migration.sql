-- AlterTable
ALTER TABLE "public"."KnowledgeBase" ADD COLUMN     "defaultChunkConfig" JSONB,
ADD COLUMN     "embeddingModel" TEXT,
ADD COLUMN     "embeddingProvider" TEXT,
ADD COLUMN     "retrievalConfig" JSONB;

-- AlterTable
ALTER TABLE "public"."KnowledgeBaseSource" ADD COLUMN     "lastIndexedAt" TIMESTAMP(3),
ADD COLUMN     "refreshInterval" TEXT,
ADD COLUMN     "sourceUrl" TEXT,
ADD COLUMN     "title" TEXT,
ALTER COLUMN "sourcePointer" DROP NOT NULL;
