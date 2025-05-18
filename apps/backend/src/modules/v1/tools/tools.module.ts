import { Module } from '@nestjs/common';
import { GoogleCalendarModule } from './google-calendar/google-calendar.module';

@Module({
  imports: [GoogleCalendarModule],
  exports: [GoogleCalendarModule],
})
export class ToolsModule {}
