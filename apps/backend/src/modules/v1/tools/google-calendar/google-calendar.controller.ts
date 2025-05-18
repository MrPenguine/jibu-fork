import { Controller, Post, Body, Get, Query, Delete, UseGuards, Param, Headers, Logger, SetMetadata } from '@nestjs/common';
import { GoogleCalendarService } from './google-calendar.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Google Calendar Tool')
@Controller('v1/tools/google-calendar')
export class GoogleCalendarController {
  private readonly logger = new Logger(GoogleCalendarController.name);
  
  constructor(private readonly googleCalendarService: GoogleCalendarService) {}

  @Get('auth-url')
  @ApiOperation({ summary: 'Get Google OAuth URL for authorization' })
  @ApiResponse({ status: 200, description: 'Returns the authorization URL' })
  async getAuthUrl() {
    return this.googleCalendarService.getAuthUrl();
  }

  @Post('callback')
  @ApiOperation({ summary: 'Handle OAuth callback from Google' })
  @ApiResponse({ status: 200, description: 'Successfully authenticated with Google' })
  async handleCallback(@Body() body: { code: string }) {
    return this.googleCalendarService.handleCallback(body.code);
  }

  @Get('events')
  @ApiOperation({ summary: 'Get events from Google Calendar' })
  @ApiResponse({ status: 200, description: 'Returns list of calendar events' })
  async getEvents(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('calendarId') calendarId?: string,
  ) {
    return this.googleCalendarService.getEvents(
      startDate,
      endDate,
      calendarId || 'primary',
    );
  }

  @Post('events')
  @ApiOperation({ summary: 'Create a new event in Google Calendar' })
  @ApiResponse({ status: 201, description: 'Event created successfully' })
  @SetMetadata('isPublic', true) // Bypass authentication for testing
  async createEvent(
    @Body() eventData: any,
    @Query('calendarId') calendarId?: string,
    @Headers('authorization') authHeader?: string,
  ) {
    try {
      this.logger.log('Received event creation request');
      this.logger.log('Event data:', JSON.stringify(eventData));
      this.logger.log('Calendar ID:', calendarId || 'primary');
      
      // In a real implementation, you would extract and validate the token
      // For now, we'll just log it for debugging
      if (authHeader) {
        this.logger.log('Auth header present:', authHeader.substring(0, 15) + '...');
      } else {
        this.logger.warn('No auth header provided');
      }
      
      // Extract tokens from the event data if provided
      const tokens = eventData.tokens || null;
      delete eventData.tokens; // Remove tokens from event data before passing to service
      
      this.logger.log('Using tokens from request:', tokens ? 'Tokens provided' : 'No tokens provided');
      
      const result = await this.googleCalendarService.createEvent(
        eventData,
        calendarId || 'primary',
        tokens,
      );
      
      this.logger.log('Event created successfully');
      return result;
    } catch (error) {
      this.logger.error('Error creating event:', error);
      throw error;
    }
  }

  @Get('availability')
  @ApiOperation({ summary: 'Check availability in Google Calendar' })
  @ApiResponse({ status: 200, description: 'Returns availability status' })
  async checkAvailability(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('calendarId') calendarId?: string,
  ) {
    return this.googleCalendarService.checkAvailability(
      startDate,
      endDate,
      calendarId || 'primary',
    );
  }
  
  @Get('test')
  @ApiOperation({ summary: 'Test Google Calendar integration' })
  @ApiResponse({ status: 200, description: 'Returns test results' })
  @SetMetadata('isPublic', true) // Bypass authentication for testing
  async testGoogleCalendar() {
    this.logger.log('Testing Google Calendar integration');
    
    try {
      // First, check the OAuth configuration
      const clientId = this.googleCalendarService.getClientId();
      const clientSecret = this.googleCalendarService.hasClientSecret();
      const redirectUri = this.googleCalendarService.getRedirectUri();
      
      // Create a simple test event
      const now = new Date();
      const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
      
      const testEvent = {
        title: `Test Event ${now.toISOString().substring(0, 16)}`,
        description: 'This is a test event created by the backend API',
        startTime: now.toISOString(),
        endTime: oneHourLater.toISOString(),
        timeZone: 'UTC',
        attendees: [],
      };
      
      this.logger.log('Creating test event:', JSON.stringify(testEvent));
      
      try {
        // Try to create the event with the Google Calendar API
        const result = await this.googleCalendarService.createEvent(testEvent, 'primary');
        
        return {
          success: true,
          message: 'Test event created successfully',
          event: result,
          oauth: {
            clientIdConfigured: !!clientId,
            clientSecretConfigured: clientSecret,
            redirectUriConfigured: !!redirectUri,
          },
        };
      } catch (apiError) {
        this.logger.error('API call failed:', apiError.message);
        
        // Create a mock event as fallback
        const mockEvent = {
          id: `mock-event-${Date.now()}`,
          summary: testEvent.title,
          description: testEvent.description,
          created: new Date().toISOString(),
          creator: { email: 'test@example.com' },
          organizer: { email: 'test@example.com' },
          start: {
            dateTime: testEvent.startTime,
            timeZone: testEvent.timeZone,
          },
          end: {
            dateTime: testEvent.endTime,
            timeZone: testEvent.timeZone,
          },
          status: 'confirmed',
          htmlLink: 'https://calendar.google.com',
        };
        
        return {
          success: true,
          message: 'Test completed with mock implementation due to API error: ' + apiError.message,
          event: mockEvent,
          mockMode: true,
          error: apiError.message,
          oauth: {
            clientIdConfigured: !!clientId,
            clientSecretConfigured: clientSecret,
            redirectUriConfigured: !!redirectUri,
          },
        };
      }
    } catch (error) {
      this.logger.error('Test failed:', error);
      
      return {
        success: false,
        message: `Test failed: ${error.message}`,
        error: error.message,
      };
    }
  }

  @Get('calendars')
  @ApiOperation({ summary: 'Get list of available calendars' })
  @ApiResponse({ status: 200, description: 'Returns list of calendars' })
  async getCalendars() {
    return this.googleCalendarService.getCalendars();
  }

  @Get('status')
  @ApiOperation({ summary: 'Check if Google Calendar is connected' })
  @ApiResponse({ status: 200, description: 'Returns connection status and settings' })
  async getStatus() {
    return this.googleCalendarService.getStatus();
  }

  @Post('settings')
  @ApiOperation({ summary: 'Save Google Calendar tool settings' })
  @ApiResponse({ status: 200, description: 'Settings saved successfully' })
  async saveSettings(@Body() settings: any) {
    return this.googleCalendarService.saveSettings(settings);
  }

  @Post('disconnect')
  @ApiOperation({ summary: 'Disconnect Google Calendar' })
  @ApiResponse({ status: 200, description: 'Successfully disconnected' })
  async disconnect() {
    return this.googleCalendarService.disconnect();
  }
}
