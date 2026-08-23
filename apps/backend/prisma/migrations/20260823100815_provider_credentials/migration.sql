-- AlterTable
ALTER TABLE "public"."Invitation" ALTER COLUMN "token" DROP DEFAULT,
ALTER COLUMN "expiresAt" SET DEFAULT CURRENT_TIMESTAMP + interval '30 days';

-- CreateTable
CREATE TABLE "public"."ProviderCredential" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'platform',
    "vaultPath" TEXT NOT NULL,
    "lastTestedAt" TIMESTAMP(3),
    "lastTestStatus" TEXT,
    "lastTestMessage" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProviderCredential_createdById_idx" ON "public"."ProviderCredential"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderCredential_provider_scope_key" ON "public"."ProviderCredential"("provider", "scope");

-- RenameForeignKey
ALTER TABLE "public"."User" RENAME CONSTRAINT "auth_users_id_fkey" TO "User_id_fkey";

-- AddForeignKey
ALTER TABLE "public"."ProviderCredential" ADD CONSTRAINT "ProviderCredential_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
