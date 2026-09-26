-- AlterTable
ALTER TABLE "public"."Invitation" ALTER COLUMN "expiresAt" SET DEFAULT CURRENT_TIMESTAMP + interval '30 days';

-- CreateTable
CREATE TABLE "public"."MockSchool" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "curriculum" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MockSchool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MockStudent" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "admissionNumber" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "curriculumTrack" TEXT NOT NULL,
    "guardianPhone" TEXT NOT NULL,

    CONSTRAINT "MockStudent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MockFeeRecord" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "totalInvoiced" DECIMAL(10,2) NOT NULL,
    "totalPaid" DECIMAL(10,2) NOT NULL,
    "waiverCredits" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "arrears" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "MockFeeRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MockMpesaTransaction" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "mpesaCode" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "accountReference" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "matchedStudentId" TEXT,
    "transactionDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MockMpesaTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MockTeacher" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,

    CONSTRAINT "MockTeacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MockTimetableSlot" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "period" INTEGER NOT NULL,
    "className" TEXT NOT NULL,
    "subject" TEXT NOT NULL,

    CONSTRAINT "MockTimetableSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MockSmsLog" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "recipientGroup" TEXT NOT NULL,
    "templateType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MockSmsLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MockSchool_code_key" ON "public"."MockSchool"("code");

-- CreateIndex
CREATE INDEX "MockStudent_schoolId_idx" ON "public"."MockStudent"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "MockStudent_schoolId_admissionNumber_key" ON "public"."MockStudent"("schoolId", "admissionNumber");

-- CreateIndex
CREATE INDEX "MockFeeRecord_studentId_idx" ON "public"."MockFeeRecord"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "MockMpesaTransaction_mpesaCode_key" ON "public"."MockMpesaTransaction"("mpesaCode");

-- CreateIndex
CREATE INDEX "MockMpesaTransaction_schoolId_idx" ON "public"."MockMpesaTransaction"("schoolId");

-- CreateIndex
CREATE INDEX "MockTeacher_schoolId_idx" ON "public"."MockTeacher"("schoolId");

-- CreateIndex
CREATE INDEX "MockTimetableSlot_schoolId_idx" ON "public"."MockTimetableSlot"("schoolId");

-- CreateIndex
CREATE INDEX "MockTimetableSlot_teacherId_idx" ON "public"."MockTimetableSlot"("teacherId");

-- CreateIndex
CREATE INDEX "MockSmsLog_schoolId_idx" ON "public"."MockSmsLog"("schoolId");

-- AddForeignKey
ALTER TABLE "public"."MockStudent" ADD CONSTRAINT "MockStudent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "public"."MockSchool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MockFeeRecord" ADD CONSTRAINT "MockFeeRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."MockStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MockMpesaTransaction" ADD CONSTRAINT "MockMpesaTransaction_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "public"."MockSchool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MockTeacher" ADD CONSTRAINT "MockTeacher_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "public"."MockSchool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MockTimetableSlot" ADD CONSTRAINT "MockTimetableSlot_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "public"."MockSchool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MockTimetableSlot" ADD CONSTRAINT "MockTimetableSlot_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "public"."MockTeacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MockSmsLog" ADD CONSTRAINT "MockSmsLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "public"."MockSchool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
