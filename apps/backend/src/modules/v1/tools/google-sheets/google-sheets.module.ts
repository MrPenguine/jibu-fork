import { Module } from '@nestjs/common';
import { GoogleSheetsController } from './google-sheets.controller';
import { GoogleSheetsService } from './google-sheets.service';
import { GoogleSheetsAuthService } from './google-sheets-auth.service';

@Module({
  controllers: [GoogleSheetsController],
  providers: [GoogleSheetsService, GoogleSheetsAuthService],
  exports: [GoogleSheetsService],
})
export class GoogleSheetsModule {}
