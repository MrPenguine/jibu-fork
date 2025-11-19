-- AlterTable
ALTER TABLE "public"."KnowledgeBaseSource" ADD COLUMN     "folderId" TEXT;

-- CreateIndex
CREATE INDEX "KnowledgeBaseSource_folderId_idx" ON "public"."KnowledgeBaseSource"("folderId");

-- AddForeignKey
ALTER TABLE "public"."KnowledgeBaseSource" ADD CONSTRAINT "KnowledgeBaseSource_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "public"."Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
