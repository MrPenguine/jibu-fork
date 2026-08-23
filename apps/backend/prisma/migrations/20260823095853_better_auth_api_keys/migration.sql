-- AlterTable
ALTER TABLE "public"."Invitation" ALTER COLUMN "token" DROP DEFAULT,
ALTER COLUMN "expiresAt" SET DEFAULT CURRENT_TIMESTAMP + interval '30 days';

-- CreateTable
CREATE TABLE "public"."auth_api_keys" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "name" TEXT,
    "start" TEXT,
    "referenceId" TEXT NOT NULL,
    "prefix" TEXT,
    "key" TEXT NOT NULL,
    "refillInterval" INTEGER,
    "refillAmount" INTEGER,
    "lastRefillAt" TIMESTAMP(3),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "rateLimitEnabled" BOOLEAN NOT NULL DEFAULT true,
    "rateLimitTimeWindow" INTEGER,
    "rateLimitMax" INTEGER,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "remaining" INTEGER,
    "lastRequest" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "permissions" TEXT,
    "metadata" TEXT,

    CONSTRAINT "auth_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_api_keys_key_key" ON "public"."auth_api_keys"("key");

-- CreateIndex
CREATE INDEX "auth_api_keys_referenceId_idx" ON "public"."auth_api_keys"("referenceId");

-- RenameForeignKey
ALTER TABLE "public"."User" RENAME CONSTRAINT "auth_users_id_fkey" TO "User_id_fkey";

-- AddForeignKey
ALTER TABLE "public"."auth_api_keys" ADD CONSTRAINT "auth_api_keys_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
