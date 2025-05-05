/*
  Warnings:

  - A unique constraint covering the columns `[organizationId,name]` on the table `ApiKey` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "ApiKey_organizationId_userId_name_key";

-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_organizationId_name_key" ON "ApiKey"("organizationId", "name");
