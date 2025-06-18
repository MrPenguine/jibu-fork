import { Module } from '@nestjs/common';
import { GoogleCalendarModule } from './google-calendar/google-calendar.module';
import { GoogleSheetsModule } from './google-sheets/google-sheets.module';
import { FunctionToolModule } from './function-tool/function-tool.module';
import { McpToolModule } from './mcp-tool/mcp-tool.module';
import { ToolsService } from './tools.service';
import { PrismaModule } from '../../../core/database/prisma.module';

@Module({
  imports: [PrismaModule, GoogleCalendarModule, GoogleSheetsModule, FunctionToolModule, McpToolModule],
  providers: [ToolsService],
  exports: [ToolsService, GoogleCalendarModule, GoogleSheetsModule, FunctionToolModule, McpToolModule],
})
export class ToolsModule {}
