import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../../core/auth/guards/admin.guard';
import { AdminPlansService, CreatePlanInput, UpdatePlanInput } from '../services/plans.service';

@ApiTags('Admin Plans')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/plans')
export class AdminPlansController {
  constructor(private readonly plansService: AdminPlansService) {}

  @Get()
  async list() {
    return this.plansService.findAll();
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.plansService.findOne(id);
  }

  @Post()
  async create(@Body() body: CreatePlanInput) {
    return this.plansService.create(body);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: UpdatePlanInput) {
    return this.plansService.update(id, body);
  }

  @Delete(':id')
  async deactivate(@Param('id') id: string) {
    return this.plansService.deactivate(id);
  }
}
