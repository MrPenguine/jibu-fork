-- AlterTable
ALTER TABLE "public"."Chat" ADD COLUMN     "disconnectReason" TEXT,
ADD COLUMN     "endedAt" TIMESTAMP(3),
ADD COLUMN     "lastUserMessageAt" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active';

-- AlterTable
ALTER TABLE "public"."Contact" ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "public"."Invitation" ALTER COLUMN "expiresAt" SET DEFAULT CURRENT_TIMESTAMP + interval '30 days';

-- CreateIndex
CREATE INDEX "Chat_sessionType_status_lastUserMessageAt_idx" ON "public"."Chat"("sessionType", "status", "lastUserMessageAt");
