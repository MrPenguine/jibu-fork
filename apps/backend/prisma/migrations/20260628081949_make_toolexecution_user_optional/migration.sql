-- DropForeignKey
ALTER TABLE "public"."ToolExecution" DROP CONSTRAINT "ToolExecution_executedById_fkey";

-- AlterTable
ALTER TABLE "public"."ToolExecution" ALTER COLUMN "executedById" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."ToolExecution" ADD CONSTRAINT "ToolExecution_executedById_fkey" FOREIGN KEY ("executedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
