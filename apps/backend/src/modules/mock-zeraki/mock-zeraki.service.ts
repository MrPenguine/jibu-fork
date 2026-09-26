import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

/**
 * A realistic simulation of Zeraki's backend, managed like a real one (real
 * Postgres tables, real lookups, real state) — exists purely so the "zeraki
 * call assistant" agent's tools (described in its system prompt) have
 * something genuine to call while testing the Tool/Intent framework. Not a
 * real Zeraki integration — see schema.prisma's Mock* models.
 */
@Injectable()
export class MockZerakiService {
  private readonly logger = new Logger(MockZerakiService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async resolveSchool(schoolCode: string) {
    const school = await this.prisma.mockSchool.findUnique({ where: { code: schoolCode.toUpperCase() } });
    if (!school) throw new Error(`Unknown school_id "${schoolCode}" — expected "NHS" or "RJS"`);
    return school;
  }

  /** lookup_student(school_id, query) — by admission number or name (fuzzy, case-insensitive). */
  async lookupStudent(schoolCode: string, query: string) {
    const school = await this.resolveSchool(schoolCode);
    const students = await this.prisma.mockStudent.findMany({
      where: {
        schoolId: school.id,
        OR: [
          { admissionNumber: { equals: query, mode: 'insensitive' } },
          { fullName: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 5,
    });
    return {
      school: school.code,
      matches: students.map((s) => ({
        admissionNumber: s.admissionNumber,
        fullName: s.fullName,
        className: s.className,
        curriculumTrack: s.curriculumTrack,
      })),
    };
  }

  /** get_fee_statement(school_id, admission_number) — invoiced/paid/waiver/arrears, net balance. */
  async getFeeStatement(schoolCode: string, admissionNumber: string) {
    const school = await this.resolveSchool(schoolCode);
    const student = await this.prisma.mockStudent.findUnique({
      where: { schoolId_admissionNumber: { schoolId: school.id, admissionNumber } },
      include: { feeRecords: { orderBy: { term: 'desc' }, take: 1 } },
    });
    if (!student) throw new Error(`No student with admission number "${admissionNumber}" at ${school.code}`);
    const record = student.feeRecords[0];
    if (!record) throw new Error(`No fee record found for ${student.fullName}`);

    const totalInvoiced = Number(record.totalInvoiced);
    const totalPaid = Number(record.totalPaid);
    const waiverCredits = Number(record.waiverCredits);
    const arrears = Number(record.arrears);
    const netBalance = totalInvoiced - totalPaid - waiverCredits + arrears;

    return {
      student: student.fullName,
      admissionNumber: student.admissionNumber,
      term: record.term,
      totalInvoiced,
      totalPaid,
      waiverCredits,
      arrears,
      netBalance,
    };
  }

  /** reconcile_mpesa_transaction(mpesa_code, school_id) — MATCHED/UNMATCHED against the transaction ledger. */
  async reconcileMpesaTransaction(mpesaCode: string, schoolCode: string) {
    const school = await this.resolveSchool(schoolCode);
    const txn = await this.prisma.mockMpesaTransaction.findFirst({
      where: { mpesaCode, schoolId: school.id },
    });
    if (!txn) throw new Error(`No M-Pesa transaction found with code "${mpesaCode}" at ${school.code}`);

    if (txn.status === 'MATCHED' && txn.matchedStudentId) {
      const student = await this.prisma.mockStudent.findUnique({ where: { id: txn.matchedStudentId } });
      return {
        status: 'MATCHED',
        mpesaCode: txn.mpesaCode,
        amount: Number(txn.amount),
        transactionDate: txn.transactionDate,
        allocatedStudent: student?.fullName || null,
      };
    }
    return {
      status: 'UNMATCHED',
      mpesaCode: txn.mpesaCode,
      amount: Number(txn.amount),
      accountReference: txn.accountReference,
      transactionDate: txn.transactionDate,
    };
  }

  /** Punctuation/case-insensitive match — a caller saying "Mr Mutiso" out
   * loud should find a record stored as "Mr. Mutiso"; Prisma's `contains`
   * can't do that at the DB level, so normalize in JS instead. */
  private normalizeName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  /** check_timetable_clashes(school_id, teacher_id, day, period) — double-booking + weekly load. */
  async checkTimetableClashes(schoolCode: string, teacherName: string, day?: string, period?: number) {
    const school = await this.resolveSchool(schoolCode);
    const candidates = await this.prisma.mockTeacher.findMany({
      where: { schoolId: school.id },
      include: { timetable: true },
    });
    const normalizedQuery = this.normalizeName(teacherName);
    const teacher = candidates.find((t) => this.normalizeName(t.name).includes(normalizedQuery));
    if (!teacher) throw new Error(`No teacher matching "${teacherName}" at ${school.code}`);

    const weeklyLoad = teacher.timetable.length;
    const slots = day || period !== undefined
      ? teacher.timetable.filter((s) => (day ? s.day === day : true) && (period !== undefined ? s.period === period : true))
      : teacher.timetable;

    // A clash = two+ different classes booked in the same day+period for this teacher.
    const byDayPeriod = new Map<string, typeof slots>();
    for (const s of teacher.timetable) {
      const key = `${s.day}-${s.period}`;
      byDayPeriod.set(key, [...(byDayPeriod.get(key) || []), s]);
    }
    const clashes = [...byDayPeriod.entries()]
      .filter(([, v]) => v.length > 1)
      .map(([key, v]) => ({ slot: key, classes: v.map((s) => s.className) }));

    return {
      teacher: teacher.name,
      subject: teacher.subject,
      weeklyLoad,
      maxRecommendedLoad: 30,
      overloaded: weeklyLoad > 30,
      requestedSlots: slots.map((s) => ({ day: s.day, period: s.period, className: s.className, subject: s.subject })),
      clashes,
    };
  }

  /** send_sms_notification(school_id, recipient_group, template_type, payload) — logs a simulated send. */
  async sendSmsNotification(schoolCode: string, recipientGroup: string, templateType: string, payload: Record<string, unknown>) {
    const school = await this.resolveSchool(schoolCode);
    const recipientCount =
      recipientGroup === 'parents_with_arrears'
        ? await this.prisma.mockFeeRecord.count({ where: { arrears: { gt: 0 }, student: { schoolId: school.id } } })
        : await this.prisma.mockStudent.count({ where: { schoolId: school.id } });

    const log = await this.prisma.mockSmsLog.create({
      data: { schoolId: school.id, recipientGroup, templateType, payload: payload as any },
    });
    return { sent: true, smsLogId: log.id, recipientGroup, templateType, estimatedRecipients: recipientCount };
  }
}
