-- AlterEnum
ALTER TYPE "public"."SttProvider" ADD VALUE 'LOCAL';

-- AlterEnum
ALTER TYPE "public"."TtsProvider" ADD VALUE 'DEEPGRAM';
ALTER TYPE "public"."TtsProvider" ADD VALUE 'GOOGLE';
ALTER TYPE "public"."TtsProvider" ADD VALUE 'CARTESIA';
ALTER TYPE "public"."TtsProvider" ADD VALUE 'LOCAL';
