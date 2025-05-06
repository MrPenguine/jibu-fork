-- CreateTable
CREATE TABLE "KnowledgeBase" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeBase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeBaseSource" (
    "id" TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'file',
    "sourcePointer" TEXT NOT NULL,
    "indexingStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeBaseSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assistant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "knowledgeBaseId" TEXT,
    "voice" JSONB,
    "model" JSONB,
    "firstMessage" TEXT,
    "voicemailMessage" TEXT,
    "endCallMessage" TEXT,
    "transcriber" JSONB,
    "endCallPhrases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "startSpeakingPlan" JSONB,
    "isServerUrlSecretSet" BOOLEAN NOT NULL DEFAULT false,
    "backgroundDenoisingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "serverMessages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "clientMessages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hipaaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assistant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KnowledgeBase_organizationId_idx" ON "KnowledgeBase"("organizationId");

-- CreateIndex
CREATE INDEX "KnowledgeBaseSource_knowledgeBaseId_idx" ON "KnowledgeBaseSource"("knowledgeBaseId");

-- CreateIndex
CREATE INDEX "KnowledgeBaseSource_organizationId_idx" ON "KnowledgeBaseSource"("organizationId");

-- CreateIndex
CREATE INDEX "KnowledgeBaseSource_sourcePointer_idx" ON "KnowledgeBaseSource"("sourcePointer");

-- CreateIndex
CREATE INDEX "Assistant_organizationId_idx" ON "Assistant"("organizationId");

-- CreateIndex
CREATE INDEX "Assistant_knowledgeBaseId_idx" ON "Assistant"("knowledgeBaseId");

-- AddForeignKey
ALTER TABLE "KnowledgeBase" ADD CONSTRAINT "KnowledgeBase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeBaseSource" ADD CONSTRAINT "KnowledgeBaseSource_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "KnowledgeBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeBaseSource" ADD CONSTRAINT "KnowledgeBaseSource_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeBaseSource" ADD CONSTRAINT "KnowledgeBaseSource_sourcePointer_fkey" FOREIGN KEY ("sourcePointer") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assistant" ADD CONSTRAINT "Assistant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assistant" ADD CONSTRAINT "Assistant_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "KnowledgeBase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
