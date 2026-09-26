-- AlterTable
ALTER TABLE "public"."Invitation" ALTER COLUMN "expiresAt" SET DEFAULT CURRENT_TIMESTAMP + interval '30 days';

-- CreateTable
CREATE TABLE "public"."AgentIntent" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "intentId" TEXT NOT NULL,

    CONSTRAINT "AgentIntent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentIntent_intentId_idx" ON "public"."AgentIntent"("intentId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentIntent_agentId_intentId_key" ON "public"."AgentIntent"("agentId", "intentId");

-- AddForeignKey
ALTER TABLE "public"."AgentIntent" ADD CONSTRAINT "AgentIntent_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "public"."Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AgentIntent" ADD CONSTRAINT "AgentIntent_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "public"."Intent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
