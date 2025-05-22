import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../../../../core/database/database.module';
import { CredentialModule } from '../../credential/credential.module';
import { GoogleCalendarController } from './google-calendar.controller';
import { GoogleCalendarService } from './google-calendar.service';
import { GoogleCalendarAuthService } from './google-calendar-auth.service';
import { GoogleCalendarToolService } from './google-calendar-tool.service';

@Module({
  imports: [ConfigModule, DatabaseModule, CredentialModule],
  controllers: [GoogleCalendarController],
  providers: [GoogleCalendarService, GoogleCalendarAuthService, GoogleCalendarToolService],
  exports: [GoogleCalendarService, GoogleCalendarAuthService],
})
export class GoogleCalendarModule {}
