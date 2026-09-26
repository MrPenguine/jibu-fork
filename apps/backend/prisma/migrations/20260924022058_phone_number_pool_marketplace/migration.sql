/*
  Warnings:

  - Added the required column `country` to the `PhoneNumber` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."PhoneNumber" DROP CONSTRAINT "PhoneNumber_workspaceId_fkey";

-- AlterTable
ALTER TABLE "public"."Invitation" ALTER COLUMN "expiresAt" SET DEFAULT CURRENT_TIMESTAMP + interval '30 days';

-- AlterTable
ALTER TABLE "public"."PhoneNumber" ADD COLUMN     "claimedAt" TIMESTAMP(3),
ADD COLUMN     "country" TEXT NOT NULL,
ADD COLUMN     "releasedAt" TIMESTAMP(3),
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'platform_pool',
ALTER COLUMN "workspaceId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "PhoneNumber_country_idx" ON "public"."PhoneNumber"("country");

-- AddForeignKey
ALTER TABLE "public"."PhoneNumber" ADD CONSTRAINT "PhoneNumber_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
