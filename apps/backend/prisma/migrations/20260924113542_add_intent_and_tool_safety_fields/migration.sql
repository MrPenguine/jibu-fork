-- AlterTable
ALTER TABLE "public"."Invitation" ALTER COLUMN "expiresAt" SET DEFAULT CURRENT_TIMESTAMP + interval '30 days';

-- AlterTable
ALTER TABLE "public"."Tool" ADD COLUMN     "requiredSlots" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "requiresConfirmation" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "public"."Intent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "agentId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "promptSnippet" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Intent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."IntentTool" (
    "id" TEXT NOT NULL,
    "intentId" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,

    CONSTRAINT "IntentTool_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Intent_workspaceId_idx" ON "public"."Intent"("workspaceId");

-- CreateIndex
CREATE INDEX "Intent_agentId_idx" ON "public"."Intent"("agentId");

-- CreateIndex
CREATE INDEX "IntentTool_toolId_idx" ON "public"."IntentTool"("toolId");

-- CreateIndex
CREATE UNIQUE INDEX "IntentTool_intentId_toolId_key" ON "public"."IntentTool"("intentId", "toolId");

-- AddForeignKey
ALTER TABLE "public"."Intent" ADD CONSTRAINT "Intent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Intent" ADD CONSTRAINT "Intent_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "public"."Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IntentTool" ADD CONSTRAINT "IntentTool_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "public"."Intent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IntentTool" ADD CONSTRAINT "IntentTool_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "public"."Tool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
