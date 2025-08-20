/*
  Warnings:

  - You are about to drop the column `organizationId` on the `Agent` table. All the data in the column will be lost.
  - You are about to drop the column `organizationId` on the `AgentSession` table. All the data in the column will be lost.
  - You are about to drop the column `organizationId` on the `ApiKey` table. All the data in the column will be lost.
  - You are about to drop the column `organizationId` on the `Assistant` table. All the data in the column will be lost.
  - You are about to drop the column `organizationId` on the `Chat` table. All the data in the column will be lost.
  - You are about to drop the column `organizationId` on the `Credential` table. All the data in the column will be lost.
  - You are about to drop the column `organizationId` on the `File` table. All the data in the column will be lost.
  - You are about to drop the column `organizationId` on the `Folder` table. All the data in the column will be lost.
  - You are about to drop the column `organizationId` on the `Invitation` table. All the data in the column will be lost.
  - You are about to drop the column `organizationId` on the `KnowledgeBase` table. All the data in the column will be lost.
  - You are about to drop the column `organizationId` on the `KnowledgeBaseSource` table. All the data in the column will be lost.
  - You are about to drop the column `organizationId` on the `N8nWorkflow` table. All the data in the column will be lost.
  - You are about to drop the column `organizationId` on the `Tool` table. All the data in the column will be lost.
  - You are about to drop the column `lastOrgId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `organizationId` on the `Workflow` table. All the data in the column will be lost.
  - You are about to drop the `Organization` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `OrganizationMembership` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[workspaceId,provider,name]` on the table `Credential` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email,workspaceId]` on the table `Invitation` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[workspaceId,name]` on the table `Tool` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `workspaceId` to the `AgentSession` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workspaceId` to the `Assistant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workspaceId` to the `Chat` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workspaceId` to the `Credential` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workspaceId` to the `File` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workspaceId` to the `Folder` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workspaceId` to the `Invitation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workspaceId` to the `KnowledgeBase` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workspaceId` to the `KnowledgeBaseSource` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workspaceId` to the `Tool` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."Agent" DROP CONSTRAINT "Agent_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "public"."AgentSession" DROP CONSTRAINT "AgentSession_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ApiKey" DROP CONSTRAINT "ApiKey_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Assistant" DROP CONSTRAINT "Assistant_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Chat" DROP CONSTRAINT "Chat_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Credential" DROP CONSTRAINT "Credential_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "public"."File" DROP CONSTRAINT "File_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Folder" DROP CONSTRAINT "Folder_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Invitation" DROP CONSTRAINT "Invitation_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "public"."KnowledgeBase" DROP CONSTRAINT "KnowledgeBase_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "public"."KnowledgeBaseSource" DROP CONSTRAINT "KnowledgeBaseSource_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "public"."N8nWorkflow" DROP CONSTRAINT "N8nWorkflow_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "public"."OrganizationMembership" DROP CONSTRAINT "OrganizationMembership_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "public"."OrganizationMembership" DROP CONSTRAINT "OrganizationMembership_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Tool" DROP CONSTRAINT "Tool_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "public"."User" DROP CONSTRAINT "User_lastOrgId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Workflow" DROP CONSTRAINT "Workflow_organizationId_fkey";

-- DropIndex
DROP INDEX "public"."Agent_organizationId_idx";

-- DropIndex
DROP INDEX "public"."AgentSession_organizationId_idx";

-- DropIndex
DROP INDEX "public"."ApiKey_organizationId_idx";

-- DropIndex
DROP INDEX "public"."Assistant_organizationId_idx";

-- DropIndex
DROP INDEX "public"."Chat_organizationId_idx";

-- DropIndex
DROP INDEX "public"."Credential_organizationId_idx";

-- DropIndex
DROP INDEX "public"."Credential_organizationId_provider_name_key";

-- DropIndex
DROP INDEX "public"."File_organizationId_idx";

-- DropIndex
DROP INDEX "public"."Invitation_organizationId_idx";

-- DropIndex
DROP INDEX "public"."KnowledgeBase_organizationId_idx";

-- DropIndex
DROP INDEX "public"."KnowledgeBaseSource_organizationId_idx";

-- DropIndex
DROP INDEX "public"."N8nWorkflow_organizationId_idx";

-- DropIndex
DROP INDEX "public"."Tool_organizationId_idx";

-- DropIndex
DROP INDEX "public"."Tool_organizationId_name_key";

-- DropIndex
DROP INDEX "public"."User_lastOrgId_idx";

-- DropIndex
DROP INDEX "public"."Workflow_organizationId_idx";

-- AlterTable
ALTER TABLE "public"."Agent" DROP COLUMN "organizationId",
ADD COLUMN     "workspaceId" TEXT;

-- AlterTable
ALTER TABLE "public"."AgentSession" DROP COLUMN "organizationId",
ADD COLUMN     "workspaceId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."ApiKey" DROP COLUMN "organizationId",
ADD COLUMN     "workspaceId" TEXT;

-- AlterTable
ALTER TABLE "public"."Assistant" DROP COLUMN "organizationId",
ADD COLUMN     "workspaceId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."Chat" DROP COLUMN "organizationId",
ADD COLUMN     "workspaceId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."Credential" DROP COLUMN "organizationId",
ADD COLUMN     "workspaceId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."File" DROP COLUMN "organizationId",
ADD COLUMN     "workspaceId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."Folder" DROP COLUMN "organizationId",
ADD COLUMN     "workspaceId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."Invitation" DROP COLUMN "organizationId",
ADD COLUMN     "workspaceId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."KnowledgeBase" DROP COLUMN "organizationId",
ADD COLUMN     "workspaceId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."KnowledgeBaseSource" DROP COLUMN "organizationId",
ADD COLUMN     "workspaceId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."N8nWorkflow" DROP COLUMN "organizationId",
ADD COLUMN     "workspaceId" TEXT;

-- AlterTable
ALTER TABLE "public"."Tool" DROP COLUMN "organizationId",
ADD COLUMN     "workspaceId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "lastOrgId",
ADD COLUMN     "lastWorkspaceId" TEXT;

-- AlterTable
ALTER TABLE "public"."Workflow" DROP COLUMN "organizationId",
ADD COLUMN     "workspaceId" TEXT;

-- DropTable
DROP TABLE "public"."Organization";

-- DropTable
DROP TABLE "public"."OrganizationMembership";

-- CreateTable
CREATE TABLE "public"."Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WorkspaceMembership" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Webhook" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "workflowId" TEXT,
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WebhookInvocation" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "headers" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookInvocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkspaceMembership_userId_idx" ON "public"."WorkspaceMembership"("userId");

-- CreateIndex
CREATE INDEX "WorkspaceMembership_workspaceId_idx" ON "public"."WorkspaceMembership"("workspaceId");

-- CreateIndex
CREATE INDEX "WorkspaceMembership_email_idx" ON "public"."WorkspaceMembership"("email");

-- CreateIndex
CREATE INDEX "Webhook_workspaceId_idx" ON "public"."Webhook"("workspaceId");

-- CreateIndex
CREATE INDEX "Webhook_workflowId_idx" ON "public"."Webhook"("workflowId");

-- CreateIndex
CREATE INDEX "WebhookInvocation_webhookId_idx" ON "public"."WebhookInvocation"("webhookId");

-- CreateIndex
CREATE INDEX "WebhookInvocation_workspaceId_idx" ON "public"."WebhookInvocation"("workspaceId");

-- CreateIndex
CREATE INDEX "WebhookInvocation_status_idx" ON "public"."WebhookInvocation"("status");

-- CreateIndex
CREATE INDEX "Agent_workspaceId_idx" ON "public"."Agent"("workspaceId");

-- CreateIndex
CREATE INDEX "AgentSession_workspaceId_idx" ON "public"."AgentSession"("workspaceId");

-- CreateIndex
CREATE INDEX "ApiKey_workspaceId_idx" ON "public"."ApiKey"("workspaceId");

-- CreateIndex
CREATE INDEX "Assistant_workspaceId_idx" ON "public"."Assistant"("workspaceId");

-- CreateIndex
CREATE INDEX "Chat_workspaceId_idx" ON "public"."Chat"("workspaceId");

-- CreateIndex
CREATE INDEX "Credential_workspaceId_idx" ON "public"."Credential"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Credential_workspaceId_provider_name_key" ON "public"."Credential"("workspaceId", "provider", "name");

-- CreateIndex
CREATE INDEX "File_workspaceId_idx" ON "public"."File"("workspaceId");

-- CreateIndex
CREATE INDEX "Invitation_workspaceId_idx" ON "public"."Invitation"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_email_workspaceId_key" ON "public"."Invitation"("email", "workspaceId");

-- CreateIndex
CREATE INDEX "KnowledgeBase_workspaceId_idx" ON "public"."KnowledgeBase"("workspaceId");

-- CreateIndex
CREATE INDEX "KnowledgeBaseSource_workspaceId_idx" ON "public"."KnowledgeBaseSource"("workspaceId");

-- CreateIndex
CREATE INDEX "N8nWorkflow_workspaceId_idx" ON "public"."N8nWorkflow"("workspaceId");

-- CreateIndex
CREATE INDEX "Tool_workspaceId_idx" ON "public"."Tool"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Tool_workspaceId_name_key" ON "public"."Tool"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "User_lastWorkspaceId_idx" ON "public"."User"("lastWorkspaceId");

-- CreateIndex
CREATE INDEX "Workflow_workspaceId_idx" ON "public"."Workflow"("workspaceId");

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_lastWorkspaceId_fkey" FOREIGN KEY ("lastWorkspaceId") REFERENCES "public"."Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorkspaceMembership" ADD CONSTRAINT "WorkspaceMembership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorkspaceMembership" ADD CONSTRAINT "WorkspaceMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invitation" ADD CONSTRAINT "Invitation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Credential" ADD CONSTRAINT "Credential_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."File" ADD CONSTRAINT "File_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Folder" ADD CONSTRAINT "Folder_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ApiKey" ADD CONSTRAINT "ApiKey_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."KnowledgeBase" ADD CONSTRAINT "KnowledgeBase_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."KnowledgeBaseSource" ADD CONSTRAINT "KnowledgeBaseSource_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Assistant" ADD CONSTRAINT "Assistant_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Chat" ADD CONSTRAINT "Chat_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Tool" ADD CONSTRAINT "Tool_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Agent" ADD CONSTRAINT "Agent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AgentSession" ADD CONSTRAINT "AgentSession_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Workflow" ADD CONSTRAINT "Workflow_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."N8nWorkflow" ADD CONSTRAINT "N8nWorkflow_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Webhook" ADD CONSTRAINT "Webhook_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Webhook" ADD CONSTRAINT "Webhook_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "public"."Workflow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WebhookInvocation" ADD CONSTRAINT "WebhookInvocation_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "public"."Webhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WebhookInvocation" ADD CONSTRAINT "WebhookInvocation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
