import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../../core/auth/guards/admin.guard';
import { AdminUsersService } from '../services/users.service';

@ApiTags('Admin Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly usersService: AdminUsersService) {}

  @Get()
  async list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : undefined;
    return this.usersService.findAll({ page: pageNum, pageSize: pageSizeNum, search });
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Get(':id/stats')
  async getStats(@Param('id') id: string) {
    return this.usersService.getActivityStats(id);
  }

  @Patch(':id/suspend')
  async suspend(
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.usersService.suspend(id, body?.reason);
  }

  @Patch(':id/unsuspend')
  async unsuspend(@Param('id') id: string) {
    return this.usersService.unsuspend(id);
  }
}
