/**
 * Seeds realistic test data for the mock Zeraki backend (two schools,
 * students, fee records, M-Pesa transactions, teachers/timetable including
 * one intentional clash, so check_timetable_clashes has something to find).
 * Idempotent — safe to re-run (upserts by natural keys, or skip-if-exists).
 *
 * Run with: npx ts-node -P apps/backend/tsconfig.app.json -r tsconfig-paths/register apps/backend/src/modules/mock-zeraki/seed-mock-zeraki.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const nhs = await prisma.mockSchool.upsert({
    where: { code: 'NHS' },
    update: {},
    create: { code: 'NHS', name: 'Nakuru Hills Secondary School', curriculum: '8-4-4' },
  });
  const rjs = await prisma.mockSchool.upsert({
    where: { code: 'RJS' },
    update: {},
    create: { code: 'RJS', name: 'Riverside Junior School', curriculum: 'CBC' },
  });

  // --- Students + fee records ---
  const nhsStudents = [
    { admissionNumber: 'NHS-2201', fullName: 'Brian Kiplangat', className: 'Form 3', invoiced: 48000, paid: 30000, waiver: 0, arrears: 18000 },
    { admissionNumber: 'NHS-2145', fullName: 'Faith Wanjiru', className: 'Form 4', invoiced: 52000, paid: 52000, waiver: 0, arrears: 0 },
    { admissionNumber: 'NHS-2298', fullName: 'Kevin Otieno', className: 'Form 2', invoiced: 45000, paid: 20000, waiver: 5000, arrears: 20000 },
    { admissionNumber: 'NHS-2310', fullName: 'Mercy Achieng', className: 'Form 1', invoiced: 44000, paid: 44000, waiver: 0, arrears: 0 },
  ];
  const rjsStudents = [
    { admissionNumber: 'RJS-1187', fullName: 'Wanjiru Mwangi', className: 'Grade 6', invoiced: 32000, paid: 32000, waiver: 0, arrears: 0 },
    { admissionNumber: 'RJS-1203', fullName: 'Dennis Kiptoo', className: 'Grade 5', invoiced: 30000, paid: 15000, waiver: 0, arrears: 15000 },
    { admissionNumber: 'RJS-1156', fullName: 'Amina Hassan', className: 'Grade 7', invoiced: 34000, paid: 34000, waiver: 2000, arrears: 0 },
  ];

  for (const s of nhsStudents) {
    const student = await prisma.mockStudent.upsert({
      where: { schoolId_admissionNumber: { schoolId: nhs.id, admissionNumber: s.admissionNumber } },
      update: {},
      create: {
        schoolId: nhs.id,
        admissionNumber: s.admissionNumber,
        fullName: s.fullName,
        className: s.className,
        curriculumTrack: '8-4-4',
        guardianPhone: '+2547' + Math.floor(10000000 + Math.random() * 89999999),
      },
    });
    const existing = await prisma.mockFeeRecord.findFirst({ where: { studentId: student.id, term: 'Term 2 2026' } });
    if (!existing) {
      await prisma.mockFeeRecord.create({
        data: {
          studentId: student.id,
          term: 'Term 2 2026',
          totalInvoiced: s.invoiced,
          totalPaid: s.paid,
          waiverCredits: s.waiver,
          arrears: s.arrears,
        },
      });
    }
  }
  for (const s of rjsStudents) {
    const student = await prisma.mockStudent.upsert({
      where: { schoolId_admissionNumber: { schoolId: rjs.id, admissionNumber: s.admissionNumber } },
      update: {},
      create: {
        schoolId: rjs.id,
        admissionNumber: s.admissionNumber,
        fullName: s.fullName,
        className: s.className,
        curriculumTrack: 'CBC',
        guardianPhone: '+2547' + Math.floor(10000000 + Math.random() * 89999999),
      },
    });
    const existing = await prisma.mockFeeRecord.findFirst({ where: { studentId: student.id, term: 'Term 2 2026' } });
    if (!existing) {
      await prisma.mockFeeRecord.create({
        data: {
          studentId: student.id,
          term: 'Term 2 2026',
          totalInvoiced: s.invoiced,
          totalPaid: s.paid,
          waiverCredits: s.waiver,
          arrears: s.arrears,
        },
      });
    }
  }

  // --- M-Pesa transactions: one matched, one unmatched (mistyped ref) per school ---
  const nhsBrian = await prisma.mockStudent.findUnique({ where: { schoolId_admissionNumber: { schoolId: nhs.id, admissionNumber: 'NHS-2201' } } });
  await prisma.mockMpesaTransaction.upsert({
    where: { mpesaCode: 'QGH7XJ2K9L' },
    update: {},
    create: {
      schoolId: nhs.id,
      mpesaCode: 'QGH7XJ2K9L',
      amount: 10000,
      accountReference: 'NHS-2201',
      status: 'MATCHED',
      matchedStudentId: nhsBrian?.id,
      transactionDate: new Date('2026-09-10T09:15:00Z'),
    },
  });
  await prisma.mockMpesaTransaction.upsert({
    where: { mpesaCode: 'QGH8YK3L0M' },
    update: {},
    create: {
      schoolId: nhs.id,
      mpesaCode: 'QGH8YK3L0M',
      amount: 15000,
      accountReference: 'NHS-2201X', // mistyped — deliberately unmatched
      status: 'UNMATCHED',
      transactionDate: new Date('2026-09-12T14:02:00Z'),
    },
  });
  const rjsDennis = await prisma.mockStudent.findUnique({ where: { schoolId_admissionNumber: { schoolId: rjs.id, admissionNumber: 'RJS-1203' } } });
  await prisma.mockMpesaTransaction.upsert({
    where: { mpesaCode: 'RFT2ABC9XZ' },
    update: {},
    create: {
      schoolId: rjs.id,
      mpesaCode: 'RFT2ABC9XZ',
      amount: 15000,
      accountReference: 'RJS-1203',
      status: 'MATCHED',
      matchedStudentId: rjsDennis?.id,
      transactionDate: new Date('2026-09-11T11:40:00Z'),
    },
  });

  // --- Teachers + timetable, with one intentional double-booking for NHS ---
  const nhsTeacher =
    (await prisma.mockTeacher.findFirst({ where: { schoolId: nhs.id, name: 'Mr. Mutiso' } })) ??
    (await prisma.mockTeacher.create({ data: { schoolId: nhs.id, name: 'Mr. Mutiso', subject: 'Mathematics' } }));

  const existingSlots = await prisma.mockTimetableSlot.count({ where: { teacherId: nhsTeacher.id } });
  if (existingSlots === 0) {
    await prisma.mockTimetableSlot.createMany({
      data: [
        { schoolId: nhs.id, teacherId: nhsTeacher.id, day: 'Monday', period: 1, className: 'Form 3', subject: 'Mathematics' },
        { schoolId: nhs.id, teacherId: nhsTeacher.id, day: 'Monday', period: 2, className: 'Form 4', subject: 'Mathematics' },
        // Intentional clash: same day+period booked for two different classes.
        { schoolId: nhs.id, teacherId: nhsTeacher.id, day: 'Tuesday', period: 3, className: 'Form 2', subject: 'Mathematics' },
        { schoolId: nhs.id, teacherId: nhsTeacher.id, day: 'Tuesday', period: 3, className: 'Form 3', subject: 'Mathematics' },
      ],
    });
  }

  console.log('Mock Zeraki seed complete:', {
    schools: [nhs.code, rjs.code],
    nhsStudents: nhsStudents.length,
    rjsStudents: rjsStudents.length,
    mpesaTransactions: 3,
    teacherWithClash: nhsTeacher.name,
  });
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
