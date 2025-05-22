import { Controller, Post, Body, Get, Query, Delete, UseGuards, Param, Headers, Logger, SetMetadata } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GoogleCalendarService } from './google-calendar.service';

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
  @SetMetadata('isPublic', true) // Make this endpoint public for testing
  async handleCallback(
    @Body() body: { code: string },
    @Headers('x-organization-id') organizationId?: string,
    @Headers('organization-id') altOrgId?: string, // Alternative header format
    @Headers('authorization') authHeader?: string,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    this.logger.log('Handling Google Calendar callback');
    
    // Use the provided organization ID or a default one for testing
    // Try both header formats
    const effectiveOrgId = organizationId || altOrgId || 'default-org-id';
    this.logger.log(`Using organization ID: ${effectiveOrgId}`);
    
    // Extract user ID from headers or use a default
    let userId = headerUserId;
    
    // If no user ID in headers but we have auth header, try to extract from there
    if (!userId && authHeader && authHeader.startsWith('Bearer ')) {
      // In a real implementation, you would properly decode the JWT
      // For now, we'll use a default user ID to ensure credentials are saved
      userId = 'default-user-id';
      this.logger.log(`Using default user ID: ${userId}`);
    }
    
    // Ensure we have a user ID
    if (!userId) {
      userId = 'default-user-id';
      this.logger.log(`No user ID found, using default: ${userId}`);
    }
    
    try {
      // Process the callback with the service
      const result = await this.googleCalendarService.handleCallback(body.code, effectiveOrgId, userId);
      
      // Return a simple JSON response - the tab will close automatically from the frontend
      return { success: true, message: 'Google Calendar connected successfully' };
    } catch (error) {
      this.logger.error('Error handling Google Calendar callback:', error);
      
      // Return a simple error response
      return { success: false, error: 'Failed to connect Google Calendar' };
    }
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
      
      // The updated service method doesn't need tokens as a parameter
      // It uses the stored tokens internally
      if (eventData.tokens) {
        delete eventData.tokens; // Remove tokens from event data before passing to service
      }
      
      this.logger.log('Creating event with calendar ID:', calendarId || 'primary');
      
      const result = await this.googleCalendarService.createEvent(
        eventData,
        calendarId || 'primary'
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
  
  @Get('status')
  @ApiOperation({ summary: 'Get Google Calendar connection status' })
  @ApiResponse({ status: 200, description: 'Returns connection status' })
  async getStatus(
    @Headers('x-organization-id') organizationId?: string,
    @Headers('authorization') authHeader?: string,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    this.logger.log('Checking Google Calendar connection status');
    
    // Use the provided organization ID or a default one for testing
    const effectiveOrgId = organizationId || 'default-org-id';
    this.logger.log(`Using organization ID: ${effectiveOrgId}`);
    
    // Extract user ID from headers or use a default
    let userId = headerUserId;
    
    // If no user ID in headers but we have auth header, try to extract from there
    if (!userId && authHeader && authHeader.startsWith('Bearer ')) {
      // In a real implementation, you would properly decode the JWT
      // For now, we'll use a default user ID
      userId = 'default-user-id';
      this.logger.log(`Using default user ID: ${userId}`);
    }
    
    // Ensure we have a user ID
    if (!userId) {
      userId = 'default-user-id';
      this.logger.log(`No user ID found, using default: ${userId}`);
    }
    
    return this.googleCalendarService.getConnectionStatus(effectiveOrgId);
  }

  @Get('test')
  @ApiOperation({ summary: 'Test Google Calendar connection' })
  @ApiResponse({ status: 200, description: 'Connection test results' })
  @SetMetadata('isPublic', true) // Bypass authentication for testing
  async testConnection() {
    this.logger.log('Testing Google Calendar connection');
    return this.googleCalendarService.test();
  }

  // Calendar list is returned as part of the test method
  // No separate endpoint needed
  
  // Use the regular createEvent method instead
  // No separate test event endpoint needed

  // Settings are saved as part of the connection process
  // No separate settings endpoint needed

  @Post('disconnect')
  @ApiOperation({ summary: 'Disconnect Google Calendar' })
  @ApiResponse({ status: 200, description: 'Successfully disconnected' })
  async disconnect(
    @Headers('x-organization-id') organizationId?: string
  ) {
    const effectiveOrgId = organizationId || 'default-org-id';
    return this.googleCalendarService.disconnect(effectiveOrgId);
  }
}
