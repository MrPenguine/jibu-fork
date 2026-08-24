ALTER TABLE "auth_users"
  ADD COLUMN IF NOT EXISTS "role" TEXT,
  ADD COLUMN IF NOT EXISTS "banned" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "banReason" TEXT,
  ADD COLUMN IF NOT EXISTS "banExpires" TIMESTAMP(3);

ALTER TABLE "auth_sessions"
  ADD COLUMN IF NOT EXISTS "impersonatedBy" TEXT;

ALTER TABLE "auth_accounts"
  ADD COLUMN IF NOT EXISTS "issuer" TEXT NOT NULL DEFAULT '';

UPDATE "auth_users" AS auth
SET "role" = 'admin'
FROM "User" AS app
WHERE auth."id" = app."id"
  AND app."isAdmin" = true
  AND (auth."role" IS NULL OR auth."role" = '');
