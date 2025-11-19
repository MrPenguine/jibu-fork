import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../../core/auth/guards/admin.guard';
import { AdminAnalyticsService } from '../services/analytics.service';
import { AdminUsageService } from '../services/usage.service';

@ApiTags('Admin Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/analytics')
export class AdminAnalyticsController {
  constructor(
    private readonly analyticsService: AdminAnalyticsService,
    private readonly usageService: AdminUsageService,
  ) {}

  @Get('revenue')
  async getRevenue(@Query('days') days?: string) {
    const daysNum = days ? parseInt(days, 10) : undefined;
    return this.analyticsService.getRevenueMetrics(daysNum);
  }

  @Get('costs')
  async getCosts(@Query('days') days?: string) {
    const daysNum = days ? parseInt(days, 10) : undefined;
    return this.analyticsService.getCostBreakdown(daysNum);
  }

  @Get('margins')
  async getMargins(@Query('days') days?: string) {
    const daysNum = days ? parseInt(days, 10) : undefined;
    return this.analyticsService.getMarginAnalysis(daysNum);
  }

  @Get('top-workspaces')
  async getTopWorkspaces(
    @Query('limit') limit?: string,
    @Query('days') days?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    const daysNum = days ? parseInt(days, 10) : undefined;
    return this.usageService.getTopWorkspaces(limitNum, daysNum);
  }
}
