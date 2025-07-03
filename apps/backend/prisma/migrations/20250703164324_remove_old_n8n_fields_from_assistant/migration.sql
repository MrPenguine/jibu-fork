/*
  Warnings:

  - You are about to drop the column `oldN8nWorkflowId` on the `Assistant` table. All the data in the column will be lost.
  - You are about to drop the column `oldWebhookUrl` on the `Assistant` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Assistant" DROP COLUMN "oldN8nWorkflowId",
DROP COLUMN "oldWebhookUrl";
