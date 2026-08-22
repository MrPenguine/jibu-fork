ALTER TABLE "public"."Workspace"
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "logo" TEXT,
  ADD COLUMN "metadata" JSONB;

UPDATE "public"."Workspace"
SET "slug" = regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g') || '-' || left("id", 8)
WHERE "slug" IS NULL;

ALTER TABLE "public"."Workspace"
  ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "Workspace_slug_key" ON "public"."Workspace"("slug");

ALTER TABLE "public"."WorkspaceMembership"
  ALTER COLUMN "status" SET DEFAULT 'active';

UPDATE "public"."WorkspaceMembership"
SET "role" = CASE lower("role")
  WHEN 'owner' THEN 'owner'
  WHEN 'admin' THEN 'admin'
  ELSE 'member'
END;

UPDATE "public"."Invitation"
SET "status" = CASE lower("status")
  WHEN 'accepted' THEN 'accepted'
  WHEN 'rejected' THEN 'rejected'
  WHEN 'canceled' THEN 'canceled'
  WHEN 'revoked' THEN 'canceled'
  WHEN 'expired' THEN 'canceled'
  ELSE 'pending'
END;

UPDATE "public"."Invitation"
SET "role" = CASE lower("role")
  WHEN 'owner' THEN 'owner'
  WHEN 'admin' THEN 'admin'
  ELSE 'member'
END;

ALTER TABLE "public"."Invitation"
  ALTER COLUMN "token" SET DEFAULT gen_random_uuid()::text,
  ALTER COLUMN "expiresAt" SET DEFAULT (CURRENT_TIMESTAMP + interval '30 days'),
  ALTER COLUMN "status" SET DEFAULT 'pending';

ALTER TABLE "public"."auth_sessions"
  ADD COLUMN "activeOrganizationId" TEXT;
