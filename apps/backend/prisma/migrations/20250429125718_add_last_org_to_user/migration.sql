-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastOrgId" TEXT;

-- CreateIndex
CREATE INDEX "User_lastOrgId_idx" ON "User"("lastOrgId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_lastOrgId_fkey" FOREIGN KEY ("lastOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
