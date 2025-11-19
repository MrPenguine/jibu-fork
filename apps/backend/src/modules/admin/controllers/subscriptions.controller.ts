import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../../core/auth/guards/admin.guard';
import { AdminSubscriptionsService, CreateSubscriptionInput, UpdateSubscriptionInput } from '../services/subscriptions.service';

@ApiTags('Admin Subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/subscriptions')
export class AdminSubscriptionsController {
  constructor(private readonly subscriptionsService: AdminSubscriptionsService) {}

  @Get()
  async list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
    @Query('planId') planId?: string,
    @Query('search') search?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : undefined;

    return this.subscriptionsService.findAll({
      page: pageNum,
      pageSize: pageSizeNum,
      status: status || undefined,
      planId: planId || undefined,
      search: search || undefined,
    });
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.subscriptionsService.findOne(id);
  }

  @Post()
  async create(@Body() body: CreateSubscriptionInput) {
    return this.subscriptionsService.create(body);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: UpdateSubscriptionInput) {
    return this.subscriptionsService.update(id, body);
  }

  @Delete(':id')
  async cancel(@Param('id') id: string) {
    return this.subscriptionsService.cancel(id);
  }
}
