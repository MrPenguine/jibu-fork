import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../core/auth/decorators/public.decorator';
import { MockZerakiService } from './mock-zeraki.service';

/**
 * HTTP surface matching the 5 tools described in the "zeraki call assistant"
 * system prompt's "Tool Inventory & Dispatch Logic" section, exactly —
 * parameter names mirror that prompt so the Tool rows created for it map
 * 1:1. Public: this is a local test simulation, not a real backend with
 * anything sensitive behind it.
 */
@ApiTags('Mock Zeraki (test simulation)')
@Public()
@Controller('mock-zeraki')
export class MockZerakiController {
  constructor(private readonly mockZeraki: MockZerakiService) {}

  @Get('lookup-student')
  lookupStudent(@Query('school_id') schoolId: string, @Query('query') query: string) {
    if (!schoolId || !query) throw new BadRequestException('school_id and query are required');
    return this.mockZeraki.lookupStudent(schoolId, query);
  }

  @Get('fee-statement')
  getFeeStatement(@Query('school_id') schoolId: string, @Query('admission_number') admissionNumber: string) {
    if (!schoolId || !admissionNumber) throw new BadRequestException('school_id and admission_number are required');
    return this.mockZeraki.getFeeStatement(schoolId, admissionNumber);
  }

  @Get('reconcile-mpesa')
  reconcileMpesa(@Query('mpesa_code') mpesaCode: string, @Query('school_id') schoolId: string) {
    if (!mpesaCode || !schoolId) throw new BadRequestException('mpesa_code and school_id are required');
    return this.mockZeraki.reconcileMpesaTransaction(mpesaCode, schoolId);
  }

  @Get('timetable-clashes')
  checkTimetableClashes(
    @Query('school_id') schoolId: string,
    @Query('teacher_id') teacherId: string,
    @Query('day') day?: string,
    @Query('period') period?: string,
  ) {
    if (!schoolId || !teacherId) throw new BadRequestException('school_id and teacher_id are required');
    return this.mockZeraki.checkTimetableClashes(schoolId, teacherId, day, period ? Number(period) : undefined);
  }

  @Post('send-sms')
  sendSms(
    @Body()
    body: { school_id: string; recipient_group: string; template_type: string; payload?: Record<string, unknown> },
  ) {
    if (!body?.school_id || !body?.recipient_group || !body?.template_type) {
      throw new BadRequestException('school_id, recipient_group, and template_type are required');
    }
    return this.mockZeraki.sendSmsNotification(body.school_id, body.recipient_group, body.template_type, body.payload || {});
  }
}
