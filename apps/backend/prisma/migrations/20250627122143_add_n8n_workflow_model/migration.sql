-- DropForeignKey
ALTER TABLE "Assistant" DROP CONSTRAINT "Assistant_n8nWorkflowId_fkey";

-- AlterTable
ALTER TABLE "Assistant" ADD COLUMN     "oldN8nWorkflowId" TEXT,
ADD COLUMN     "oldWebhookUrl" TEXT;
