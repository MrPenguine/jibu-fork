-- AlterTable
ALTER TABLE "public"."ChunkMetadata" ADD COLUMN     "chunkType" TEXT NOT NULL DEFAULT 'content',
ADD COLUMN     "strategies" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "public"."KnowledgeBaseSource" ADD COLUMN     "chunkConfig" JSONB;
