/*
  Warnings:

  - The values [ASSISTANT] on the enum `AgentNodeType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `assistantId` on the `Agent` table. All the data in the column will be lost.
  - You are about to drop the column `assistantId` on the `Chat` table. All the data in the column will be lost.
  - You are about to drop the column `masterWorkflowId` on the `Workflow` table. All the data in the column will be lost.
  - You are about to drop the column `workflowType` on the `Workflow` table. All the data in the column will be lost.
  - You are about to drop the `Assistant` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AssistantTool` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."AgentNodeType_new" AS ENUM ('START', 'END', 'MESSAGE', 'LISTEN', 'CHOICE', 'CONDITION', 'SET_VARIABLE', 'API_CALL', 'TOOL_CALL', 'FUNCTION_CALL', 'TRANSFER', 'RECORD', 'PLAY_AUDIO', 'WORKFLOW_CALL');
ALTER TABLE "public"."Chat" ALTER COLUMN "nodeType" TYPE "public"."AgentNodeType_new" USING ("nodeType"::text::"public"."AgentNodeType_new");
ALTER TYPE "public"."AgentNodeType" RENAME TO "AgentNodeType_old";
ALTER TYPE "public"."AgentNodeType_new" RENAME TO "AgentNodeType";
DROP TYPE "public"."AgentNodeType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "public"."Agent" DROP CONSTRAINT "Agent_assistantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Assistant" DROP CONSTRAINT "Assistant_knowledgeBaseId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Assistant" DROP CONSTRAINT "Assistant_n8nWorkflowId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Assistant" DROP CONSTRAINT "Assistant_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "public"."AssistantTool" DROP CONSTRAINT "AssistantTool_assistantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."AssistantTool" DROP CONSTRAINT "AssistantTool_toolId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Chat" DROP CONSTRAINT "Chat_assistantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Workflow" DROP CONSTRAINT "Workflow_masterWorkflowId_fkey";

-- DropIndex
DROP INDEX "public"."Chat_assistantId_idx";

-- DropIndex
DROP INDEX "public"."Chat_assistantId_sessionId_key";

-- DropIndex
DROP INDEX "public"."Workflow_masterWorkflowId_idx";

-- AlterTable
ALTER TABLE "public"."Agent" DROP COLUMN "assistantId",
ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "public"."Chat" DROP COLUMN "assistantId";

-- AlterTable
ALTER TABLE "public"."Workflow" DROP COLUMN "masterWorkflowId",
DROP COLUMN "workflowType";

-- DropTable
DROP TABLE "public"."Assistant";

-- DropTable
DROP TABLE "public"."AssistantTool";

-- DropEnum
DROP TYPE "public"."WorkflowType";
