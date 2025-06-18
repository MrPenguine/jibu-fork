-- CreateTable
CREATE TABLE "Chat" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "organizationId" TEXT NOT NULL,
    "assistantId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sessionType" TEXT NOT NULL DEFAULT 'chat',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'text',
    "sequenceId" INTEGER NOT NULL,
    "redisStatus" TEXT DEFAULT 'pending',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Chat_organizationId_idx" ON "Chat"("organizationId");

-- CreateIndex
CREATE INDEX "Chat_assistantId_idx" ON "Chat"("assistantId");

-- CreateIndex
CREATE INDEX "Chat_sessionId_idx" ON "Chat"("sessionId");

-- CreateIndex
CREATE INDEX "Chat_sessionType_idx" ON "Chat"("sessionType");

-- CreateIndex
CREATE UNIQUE INDEX "Chat_assistantId_sessionId_key" ON "Chat"("assistantId", "sessionId");

-- CreateIndex
CREATE INDEX "Message_chatId_idx" ON "Message"("chatId");

-- CreateIndex
CREATE INDEX "Message_role_idx" ON "Message"("role");

-- CreateIndex
CREATE INDEX "Message_type_idx" ON "Message"("type");

-- CreateIndex
CREATE INDEX "Message_chatId_sequenceId_idx" ON "Message"("chatId", "sequenceId");

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_assistantId_fkey" FOREIGN KEY ("assistantId") REFERENCES "Assistant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
