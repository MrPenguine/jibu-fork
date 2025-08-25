/*
  Warnings:

  - You are about to drop the column `metadata` on the `Agent` table. All the data in the column will be lost.
  - You are about to drop the column `backgroundDenoisingEnabled` on the `Assistant` table. All the data in the column will be lost.
  - You are about to drop the column `clientMessages` on the `Assistant` table. All the data in the column will be lost.
  - You are about to drop the column `endCallMessage` on the `Assistant` table. All the data in the column will be lost.
  - You are about to drop the column `endCallPhrases` on the `Assistant` table. All the data in the column will be lost.
  - You are about to drop the column `hipaaEnabled` on the `Assistant` table. All the data in the column will be lost.
  - You are about to drop the column `isServerUrlSecretSet` on the `Assistant` table. All the data in the column will be lost.
  - You are about to drop the column `model` on the `Assistant` table. All the data in the column will be lost.
  - You are about to drop the column `serverMessages` on the `Assistant` table. All the data in the column will be lost.
  - You are about to drop the column `startSpeakingPlan` on the `Assistant` table. All the data in the column will be lost.
  - You are about to drop the column `transcriber` on the `Assistant` table. All the data in the column will be lost.
  - You are about to drop the column `voice` on the `Assistant` table. All the data in the column will be lost.
  - You are about to drop the column `voicemailMessage` on the `Assistant` table. All the data in the column will be lost.
  - You are about to drop the column `isPublished` on the `Workflow` table. All the data in the column will be lost.
  - You are about to drop the column `publishedAt` on the `Workflow` table. All the data in the column will be lost.
  - You are about to drop the column `version` on the `Workflow` table. All the data in the column will be lost.
  - You are about to drop the column `workflowJson` on the `Workflow` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[primaryWorkflowId]` on the table `Agent` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[publishedVersionId]` on the table `Workflow` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[draftVersionId]` on the table `Workflow` will be added. If there are existing duplicate values, this will fail.
  - Made the column `workspaceId` on table `Agent` required. This step will fail if there are existing NULL values in that column.
  - Made the column `workspaceId` on table `Workflow` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "public"."LlmProvider" AS ENUM ('OPENAI', 'ANTHROPIC', 'AZURE_OPENAI', 'GOOGLE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "public"."LlmModelPreset" AS ENUM ('GPT_4O_MINI', 'CLAUDE_3_5_SONNET', 'CUSTOM');

-- CreateEnum
CREATE TYPE "public"."TtsProvider" AS ENUM ('OPENAI', 'AZURE', 'ELEVENLABS', 'CUSTOM');

-- CreateEnum
CREATE TYPE "public"."SttProvider" AS ENUM ('WHISPER', 'AZURE', 'DEEPGRAM', 'GOOGLE', 'CUSTOM');

-- DropIndex
DROP INDEX "public"."Agent_assistantId_idx";

-- DropIndex
DROP INDEX "public"."Agent_n8nWorkflowId_idx";

-- AlterTable
ALTER TABLE "public"."Agent" DROP COLUMN "metadata",
ADD COLUMN     "backgroundDenoisingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "clientMessages" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "endCallMessage" TEXT,
ADD COLUMN     "endCallPhrases" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "firstMessage" TEXT,
ADD COLUMN     "hipaaEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isServerUrlSecretSet" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "llmModel" TEXT,
ADD COLUMN     "llmProvider" "public"."LlmProvider",
ADD COLUMN     "primaryWorkflowId" TEXT,
ADD COLUMN     "serverMessages" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "startSpeakingPlan" JSONB,
ADD COLUMN     "sttModel" TEXT,
ADD COLUMN     "sttProvider" "public"."SttProvider",
ADD COLUMN     "ttsProvider" "public"."TtsProvider",
ADD COLUMN     "ttsVoiceId" TEXT,
ADD COLUMN     "voicemailMessage" TEXT,
ALTER COLUMN "workspaceId" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."Assistant" DROP COLUMN "backgroundDenoisingEnabled",
DROP COLUMN "clientMessages",
DROP COLUMN "endCallMessage",
DROP COLUMN "endCallPhrases",
DROP COLUMN "hipaaEnabled",
DROP COLUMN "isServerUrlSecretSet",
DROP COLUMN "model",
DROP COLUMN "serverMessages",
DROP COLUMN "startSpeakingPlan",
DROP COLUMN "transcriber",
DROP COLUMN "voice",
DROP COLUMN "voicemailMessage",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "llmModelOverride" TEXT,
ADD COLUMN     "llmProviderOverride" "public"."LlmProvider",
ADD COLUMN     "systemMessage" TEXT;

-- AlterTable
ALTER TABLE "public"."Workflow" DROP COLUMN "isPublished",
DROP COLUMN "publishedAt",
DROP COLUMN "version",
DROP COLUMN "workflowJson",
ADD COLUMN     "draftVersionId" TEXT,
ADD COLUMN     "publishedVersionId" TEXT,
ALTER COLUMN "workspaceId" SET NOT NULL;

-- CreateTable
CREATE TABLE "public"."WorkflowVersion" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workflowId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "workflowJson" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "WorkflowVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkflowVersion_workflowId_idx" ON "public"."WorkflowVersion"("workflowId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowVersion_workflowId_version_key" ON "public"."WorkflowVersion"("workflowId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_primaryWorkflowId_key" ON "public"."Agent"("primaryWorkflowId");

-- CreateIndex
CREATE INDEX "Agent_folderId_idx" ON "public"."Agent"("folderId");

-- CreateIndex
CREATE UNIQUE INDEX "Workflow_publishedVersionId_key" ON "public"."Workflow"("publishedVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "Workflow_draftVersionId_key" ON "public"."Workflow"("draftVersionId");

-- CreateIndex
CREATE INDEX "Workflow_masterWorkflowId_idx" ON "public"."Workflow"("masterWorkflowId");

-- CreateIndex
CREATE INDEX "Workflow_n8nWorkflowId_idx" ON "public"."Workflow"("n8nWorkflowId");

-- AddForeignKey
ALTER TABLE "public"."Agent" ADD CONSTRAINT "Agent_primaryWorkflowId_fkey" FOREIGN KEY ("primaryWorkflowId") REFERENCES "public"."Workflow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Workflow" ADD CONSTRAINT "Workflow_publishedVersionId_fkey" FOREIGN KEY ("publishedVersionId") REFERENCES "public"."WorkflowVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Workflow" ADD CONSTRAINT "Workflow_draftVersionId_fkey" FOREIGN KEY ("draftVersionId") REFERENCES "public"."WorkflowVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorkflowVersion" ADD CONSTRAINT "WorkflowVersion_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "public"."Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
