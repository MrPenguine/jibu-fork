import { Module } from '@nestjs/common';
import { OnboardingStatusController } from './onboarding-status.controller';
import { OnboardingStatusService } from './onboarding-status.service';
import { PrismaService } from '../../../core/database/prisma.service';

@Module({
  controllers: [OnboardingStatusController],
  providers: [OnboardingStatusService, PrismaService],
  exports: [OnboardingStatusService],
})
export class OnboardingStatusModule {}
