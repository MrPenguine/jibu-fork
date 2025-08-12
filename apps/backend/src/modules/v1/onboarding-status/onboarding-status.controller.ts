import { Controller, Get, Put, Post, Body, UseGuards, Req, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { OnboardingStatusService } from './onboarding-status.service';
import { UpdateOnboardingStatusDto } from './dto/update-onboarding-status.dto';
import { User } from '@prisma/client';

@ApiTags('onboarding-status')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('v1/onboarding-status')
export class OnboardingStatusController {
  private readonly logger = new Logger(OnboardingStatusController.name);

  constructor(private readonly onboardingStatusService: OnboardingStatusService) {}

  @Get()
  @ApiOperation({ summary: 'Get the onboarding status for the current user' })
  @ApiResponse({ status: 200, description: 'Returns the onboarding status' })
  async getStatus(@Req() req) {
    const userId = (req.user as User).id;
    this.logger.log(`Getting onboarding status for user ${userId}`);
    return this.onboardingStatusService.getStatus(userId);
  }

  @Put()
  @ApiOperation({ summary: 'Update the onboarding status for the current user' })
  @ApiResponse({ status: 200, description: 'Returns the updated onboarding status' })
  async updateStatus(@Req() req, @Body() updateDto: UpdateOnboardingStatusDto) {
    const userId = (req.user as User).id;
    this.logger.log(`Updating onboarding status for user ${userId}`);
    return this.onboardingStatusService.updateStatus(userId, updateDto);
  }

  @Post('reset')
  @ApiOperation({ summary: 'Reset the onboarding status for the current user' })
  @ApiResponse({ status: 200, description: 'Returns the reset onboarding status' })
  @ApiResponse({ status: 404, description: 'Onboarding status not found' })
  async resetStatus(@Req() req) {
    const userId = (req.user as User).id;
    this.logger.log(`Resetting onboarding status for user ${userId}`);
    return this.onboardingStatusService.resetStatus(userId);
  }
}
