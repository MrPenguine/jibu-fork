/*
  Warnings:

  - You are about to drop the column `isDefault` on the `ApiKey` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[prefix]` on the table `ApiKey` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `ApiKey` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."ApiKey_organizationId_name_key";

-- AlterTable
ALTER TABLE "public"."Agent" ADD COLUMN     "folderId" TEXT;

-- AlterTable
ALTER TABLE "public"."ApiKey" DROP COLUMN "isDefault",
ADD COLUMN     "agentId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "public"."Invitation" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "public"."Folder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Folder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OnboardingStatus" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAgent" BOOLEAN NOT NULL DEFAULT false,
    "addedTool" BOOLEAN NOT NULL DEFAULT false,
    "addedPhoneNumber" BOOLEAN NOT NULL DEFAULT false,
    "ranTest" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingStatus_userId_key" ON "public"."OnboardingStatus"("userId");

-- CreateIndex
CREATE INDEX "Agent_n8nWorkflowId_idx" ON "public"."Agent"("n8nWorkflowId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_prefix_key" ON "public"."ApiKey"("prefix");

-- CreateIndex
CREATE INDEX "ApiKey_agentId_idx" ON "public"."ApiKey"("agentId");

-- AddForeignKey
ALTER TABLE "public"."Folder" ADD CONSTRAINT "Folder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ApiKey" ADD CONSTRAINT "ApiKey_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "public"."Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OnboardingStatus" ADD CONSTRAINT "OnboardingStatus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Agent" ADD CONSTRAINT "Agent_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "public"."Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
