import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PhoneNumberController } from './phone-number.controller';
import { PhoneNumberService } from './phone-number.service';
import { TwilioService } from './twilio.service';
import { PrismaModule } from '../../../core/database/prisma.module';
import { LiveKitModule } from '../../livekit/livekit.module';

@Module({
  // ProviderCredentialsResolver comes from the @Global() ProviderCredentialsModule
  // (registered once in AppModule) — no explicit import needed here.
  // ScheduleModule.forRoot() is safe to call from multiple modules (Nest
  // dedupes it) — it's what makes @Interval() in PhoneNumberService work,
  // powering the periodic Twilio pool sync below.
  imports: [PrismaModule, LiveKitModule, ScheduleModule.forRoot()],
  controllers: [PhoneNumberController],
  providers: [PhoneNumberService, TwilioService],
  exports: [PhoneNumberService],
})
export class PhoneNumberModule {}
