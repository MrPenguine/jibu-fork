-- AlterTable
ALTER TABLE "public"."Agent" ALTER COLUMN "sttProvider" SET DEFAULT 'LOCAL',
ALTER COLUMN "ttsProvider" SET DEFAULT 'LOCAL';

-- AlterTable (pre-existing schema/DB drift, unrelated to this change, picked up incidentally)
ALTER TABLE "public"."Invitation" ALTER COLUMN "expiresAt" SET DEFAULT CURRENT_TIMESTAMP + interval '30 days';
