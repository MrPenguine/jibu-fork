-- CreateEnum
CREATE TYPE "public"."KnowledgeBaseVisibility" AS ENUM ('AGENT', 'WORKSPACE');

-- AlterTable
ALTER TABLE "public"."Invitation" ALTER COLUMN "token" DROP DEFAULT,
ALTER COLUMN "expiresAt" SET DEFAULT CURRENT_TIMESTAMP + interval '30 days';

-- AlterTable
ALTER TABLE "public"."KnowledgeBase" ADD COLUMN     "visibility" "public"."KnowledgeBaseVisibility" NOT NULL DEFAULT 'AGENT';
