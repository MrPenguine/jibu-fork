import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GoogleCalendarController } from './google-calendar.controller';
import { GoogleCalendarService } from './google-calendar.service';
import { GoogleCalendarAuthService } from './google-calendar-auth.service';

@Module({
  imports: [ConfigModule],
  controllers: [GoogleCalendarController],
  providers: [GoogleCalendarService, GoogleCalendarAuthService],
  exports: [GoogleCalendarService, GoogleCalendarAuthService],
})
export class GoogleCalendarModule {}
