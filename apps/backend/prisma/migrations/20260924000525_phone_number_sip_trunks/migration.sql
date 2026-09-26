/*
  Warnings:

  - You are about to drop the column `sipTrunkId` on the `PhoneNumber` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Invitation" ALTER COLUMN "expiresAt" SET DEFAULT CURRENT_TIMESTAMP + interval '30 days';

-- AlterTable
ALTER TABLE "public"."PhoneNumber" DROP COLUMN "sipTrunkId",
ADD COLUMN     "providerConfig" JSONB,
ADD COLUMN     "sipDispatchRuleId" TEXT,
ADD COLUMN     "sipInboundTrunkId" TEXT,
ADD COLUMN     "sipOutboundTrunkId" TEXT;
