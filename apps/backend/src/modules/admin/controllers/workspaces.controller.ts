import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../../core/auth/guards/admin.guard';
import { AdminWorkspacesService } from '../services/workspaces.service';

@ApiTags('Admin Workspaces')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/workspaces')
export class AdminWorkspacesController {
  constructor(private readonly workspacesService: AdminWorkspacesService) {}

  @Get()
  async list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : undefined;
    return this.workspacesService.findAll({ page: pageNum, pageSize: pageSizeNum, search });
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.workspacesService.findOne(id);
  }

  @Get(':id/usage')
  async getUsage(
    @Param('id') id: string,
    @Query('days') days?: string,
  ) {
    const daysNum = days ? parseInt(days, 10) : undefined;
    return this.workspacesService.getUsageStats(id, daysNum);
  }

  @Patch(':id/suspend')
  async suspend(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Req() req: any,
  ) {
    const adminUserId = req.user?.id as string | undefined;
    return this.workspacesService.suspend(id, body?.reason, adminUserId);
  }

  @Patch(':id/unsuspend')
  async unsuspend(@Param('id') id: string) {
    return this.workspacesService.unsuspend(id);
  }
}
