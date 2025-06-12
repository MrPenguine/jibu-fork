/*
  Warnings:

  - A unique constraint covering the columns `[agentId,sessionId]` on the table `Chat` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Chat" DROP CONSTRAINT "Chat_assistantId_fkey";

-- AlterTable
ALTER TABLE "Chat" ALTER COLUMN "assistantId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Chat_agentId_sessionId_key" ON "Chat"("agentId", "sessionId");

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_assistantId_fkey" FOREIGN KEY ("assistantId") REFERENCES "Assistant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
