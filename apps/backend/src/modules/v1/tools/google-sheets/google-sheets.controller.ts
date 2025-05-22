import { Controller, Post, Body, Get, Query, Delete, UseGuards, Param, Headers, Logger, SetMetadata } from '@nestjs/common';
import { GoogleSheetsService } from './google-sheets.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Google Sheets Tool')
@Controller('v1/tools/google-sheets')
export class GoogleSheetsController {
  private readonly logger = new Logger(GoogleSheetsController.name);
  
  constructor(private readonly googleSheetsService: GoogleSheetsService) {}

  @Get('auth-url')
  @ApiOperation({ summary: 'Get Google OAuth URL for authorization' })
  @ApiResponse({ status: 200, description: 'Returns the authorization URL' })
  async getAuthUrl() {
    return this.googleSheetsService.getAuthUrl();
  }

  @Post('callback')
  @ApiOperation({ summary: 'Handle OAuth callback from Google' })
  @ApiResponse({ status: 200, description: 'Successfully authenticated with Google' })
  async handleCallback(@Body() body: { code: string }) {
    return this.googleSheetsService.handleCallback(body.code);
  }

  @Get('spreadsheets')
  @ApiOperation({ summary: 'Get list of available spreadsheets' })
  @ApiResponse({ status: 200, description: 'Returns list of spreadsheets' })
  async getSpreadsheets() {
    return this.googleSheetsService.getSpreadsheets();
  }

  @Get('spreadsheets/:spreadsheetId/sheets')
  @ApiOperation({ summary: 'Get sheets in a spreadsheet' })
  @ApiResponse({ status: 200, description: 'Returns list of sheets' })
  async getSheets(@Param('spreadsheetId') spreadsheetId: string) {
    return this.googleSheetsService.getSheets(spreadsheetId);
  }

  @Get('spreadsheets/:spreadsheetId/values/:range')
  @ApiOperation({ summary: 'Get values from a spreadsheet range' })
  @ApiResponse({ status: 200, description: 'Returns values from the specified range' })
  async getValues(
    @Param('spreadsheetId') spreadsheetId: string,
    @Param('range') range: string,
  ) {
    return this.googleSheetsService.getValues(spreadsheetId, range);
  }

  @Post('spreadsheets/:spreadsheetId/values/:range')
  @ApiOperation({ summary: 'Update values in a spreadsheet range' })
  @ApiResponse({ status: 200, description: 'Values updated successfully' })
  @SetMetadata('isPublic', true) // Bypass authentication for testing
  async updateValues(
    @Param('spreadsheetId') spreadsheetId: string,
    @Param('range') range: string,
    @Body() data: { values: any[][] },
    @Headers('authorization') authHeader?: string,
  ) {
    try {
      this.logger.log('Received values update request');
      this.logger.log('Spreadsheet ID:', spreadsheetId);
      this.logger.log('Range:', range);
      
      // In a real implementation, you would extract and validate the token
      if (authHeader) {
        this.logger.log('Auth header present:', authHeader.substring(0, 15) + '...');
      } else {
        this.logger.warn('No auth header provided');
      }
      
      const result = await this.googleSheetsService.updateValues(
        spreadsheetId,
        range,
        data.values,
      );
      
      this.logger.log('Values updated successfully');
      return result;
    } catch (error) {
      this.logger.error('Error updating values:', error);
      throw error;
    }
  }

  @Post('spreadsheets/:spreadsheetId/values/:range/append')
  @ApiOperation({ summary: 'Append values to a spreadsheet range' })
  @ApiResponse({ status: 200, description: 'Values appended successfully' })
  @SetMetadata('isPublic', true) // Bypass authentication for testing
  async appendValues(
    @Param('spreadsheetId') spreadsheetId: string,
    @Param('range') range: string,
    @Body() data: { values: any[][] },
    @Headers('authorization') authHeader?: string,
  ) {
    try {
      this.logger.log('Received values append request');
      this.logger.log('Spreadsheet ID:', spreadsheetId);
      this.logger.log('Range:', range);
      this.logger.log('Data to append:', JSON.stringify(data.values));
      
      // In a real implementation, you would extract and validate the token
      if (authHeader) {
        this.logger.log('Auth header present:', authHeader.substring(0, 15) + '...');
      } else {
        this.logger.warn('No auth header provided');
      }
      
      const result = await this.googleSheetsService.appendValues(
        spreadsheetId,
        range,
        data.values,
      );
      
      this.logger.log('Values appended successfully');
      return result;
    } catch (error) {
      this.logger.error('Error appending values:', error);
      throw error;
    }
  }

  @Post('spreadsheets')
  @ApiOperation({ summary: 'Create a new spreadsheet' })
  @ApiResponse({ status: 201, description: 'Spreadsheet created successfully' })
  @SetMetadata('isPublic', true) // Bypass authentication for testing
  async createSpreadsheet(
    @Body() data: { title: string, sheets?: { title: string }[] },
  ) {
    return this.googleSheetsService.createSpreadsheet(data.title, data.sheets);
  }
  
  @Get('test')
  @ApiOperation({ summary: 'Test Google Sheets connection' })
  @ApiResponse({ status: 200, description: 'Connection test results' })
  @SetMetadata('isPublic', true) // Bypass authentication for testing
  async testConnection() {
    this.logger.log('Testing Google Sheets connection');
    return this.googleSheetsService.testConnection();
  }

  @Post('test-sheet')
  @ApiOperation({ summary: 'Create a test spreadsheet in Google Sheets' })
  @ApiResponse({ status: 201, description: 'Test spreadsheet created successfully' })
  @SetMetadata('isPublic', true) // Bypass authentication for testing
  async createTestSpreadsheet() {
    return this.googleSheetsService.createTestSpreadsheet();
  }

  @Post('settings')
  @ApiOperation({ summary: 'Save Google Sheets tool settings' })
  @ApiResponse({ status: 200, description: 'Settings saved successfully' })
  async saveSettings(@Body() settings: any) {
    return this.googleSheetsService.saveSettings(settings);
  }

  @Post('disconnect')
  @ApiOperation({ summary: 'Disconnect Google Sheets' })
  @ApiResponse({ status: 200, description: 'Successfully disconnected' })
  async disconnect() {
    return this.googleSheetsService.disconnect();
  }
}
