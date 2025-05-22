import { Module } from '@nestjs/common';
import { GoogleCalendarModule } from './google-calendar/google-calendar.module';
import { GoogleSheetsModule } from './google-sheets/google-sheets.module';
import { FunctionToolModule } from './function-tool/function-tool.module';
import { McpToolModule } from './mcp-tool/mcp-tool.module';

@Module({
  imports: [GoogleCalendarModule, GoogleSheetsModule, FunctionToolModule, McpToolModule],
  exports: [GoogleCalendarModule, GoogleSheetsModule, FunctionToolModule, McpToolModule],
})
export class ToolsModule {}
