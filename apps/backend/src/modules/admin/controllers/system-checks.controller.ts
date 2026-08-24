import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../../core/auth/guards/admin.guard';
import { AdminSystemChecksService } from '../services/system-checks.service';

@ApiTags('Admin System Checks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/system-checks')
export class AdminSystemChecksController {
  constructor(private readonly systemChecksService: AdminSystemChecksService) {}

  @Get()
  run() {
    return this.systemChecksService.runAll();
  }
}
