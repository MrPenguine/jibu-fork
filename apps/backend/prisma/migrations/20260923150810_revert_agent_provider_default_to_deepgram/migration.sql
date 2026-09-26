-- AlterTable
ALTER TABLE "public"."Agent" ALTER COLUMN "sttProvider" SET DEFAULT 'DEEPGRAM',
ALTER COLUMN "ttsProvider" SET DEFAULT 'DEEPGRAM';

-- AlterTable
ALTER TABLE "public"."Invitation" ALTER COLUMN "expiresAt" SET DEFAULT CURRENT_TIMESTAMP + interval '30 days';
