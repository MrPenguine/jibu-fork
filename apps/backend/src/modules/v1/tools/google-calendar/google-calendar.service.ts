import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { ConfigService } from '@nestjs/config';
import { GoogleCalendarAuthService } from './google-calendar-auth.service';

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);
  private oauth2Client;

  constructor(
    private configService: ConfigService,
    private googleCalendarAuthService: GoogleCalendarAuthService
  ) {
    this.oauth2Client = new google.auth.OAuth2(
      this.configService.get('GOOGLE_CLIENT_ID'),
      this.configService.get('GOOGLE_CLIENT_SECRET'),
      this.configService.get('GOOGLE_REDIRECT_URI') || 'http://localhost:3000/api/auth/callback/google',
    );
  }

  async getAuthUrl() {
    try {
      // Log the client ID to verify it's properly loaded from env
      const clientId = this.configService.get('GOOGLE_CLIENT_ID');
      const clientSecret = this.configService.get('GOOGLE_CLIENT_SECRET');
      const redirectUri = this.configService.get('GOOGLE_REDIRECT_URI');
      
      this.logger.log('OAuth configuration:');
      this.logger.log(`- Client ID: ${clientId ? clientId.substring(0, 10) + '...' : 'NOT SET'}`);
      this.logger.log(`- Client Secret: ${clientSecret ? 'PRESENT' : 'NOT SET'}`);
      this.logger.log(`- Redirect URI: ${redirectUri || 'NOT SET'}`);
      
      // Define the required scopes for Google Calendar
      const scopes = [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
      ];

      // Generate the authorization URL
      const url = this.oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent', // Force to get refresh_token every time
        include_granted_scopes: true, // Include previously granted scopes
      });

      this.logger.log(`Generated auth URL: ${url.substring(0, 50)}...`);
      return { authUrl: url };
    } catch (error) {
      this.logger.error('Error generating auth URL:', error);
      throw error;
    }
  }

  async handleCallback(code: string) {
    try {
      this.logger.log(`Processing OAuth callback with code: ${code.substring(0, 10)}...`);
      
      const { tokens } = await this.oauth2Client.getToken(code);
      this.logger.log('Successfully exchanged code for tokens');
      
      // Set the credentials on the OAuth client
      this.oauth2Client.setCredentials(tokens);
      
      // Store tokens in memory for demo purposes
      // In a real application, you would store these in a database associated with the user
      this.storeTokensInMemory(tokens);
      
      return { 
        success: true,
        tokens,
      };
    } catch (error) {
      this.logger.error('Error handling Google Calendar callback', error);
      throw error;
    }
  }
  
  // In-memory token storage for demo purposes
  private static tokensStore = null;
  
  private storeTokensInMemory(tokens) {
    this.logger.log('Storing tokens in memory');
    GoogleCalendarService.tokensStore = tokens;
  }
  
  private getStoredTokens() {
    return GoogleCalendarService.tokensStore;
  }
  
  // Helper methods to access OAuth configuration
  getClientId(): string | undefined {
    return this.configService.get('GOOGLE_CLIENT_ID');
  }
  
  hasClientSecret(): boolean {
    return !!this.configService.get('GOOGLE_CLIENT_SECRET');
  }
  
  getRedirectUri(): string | undefined {
    return this.configService.get('GOOGLE_REDIRECT_URI');
  }

  async getEvents(startDate: string, endDate: string, calendarId = 'primary', tokens?: any) {
    try {
      if (tokens) {
        this.oauth2Client.setCredentials(tokens);
      }
      
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
      
      const response = await calendar.events.list({
        calendarId,
        timeMin: new Date(startDate).toISOString(),
        timeMax: new Date(endDate).toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });
      
      return response.data.items;
    } catch (error) {
      this.logger.error('Error getting Google Calendar events', error);
      throw error;
    }
  }

  async createEvent(eventData: any, calendarId = 'primary', tokens?: any) {
    try {
      this.logger.log(`Creating event in calendar ${calendarId}`);
      this.logger.log('Event data received:', JSON.stringify(eventData));
      
      // Ensure the OAuth client has the correct client ID and secret
      const clientId = this.configService.get('GOOGLE_CLIENT_ID');
      const clientSecret = this.configService.get('GOOGLE_CLIENT_SECRET');
      const redirectUri = this.configService.get('GOOGLE_REDIRECT_URI') || 'http://localhost:3000/api/auth/callback/google';
      
      if (!clientId || !clientSecret) {
        this.logger.error('Missing Google OAuth credentials - check environment variables');
        throw new Error('Google OAuth credentials not configured');
      }
      
      // Recreate the OAuth client to ensure it has the latest credentials
      this.oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        redirectUri
      );
      
      let calendar;
      
      try {
        // Try multiple authentication methods to ensure we can create the event
        
        // Method 1: Use provided tokens if available
        if (tokens && tokens.access_token) {
          this.logger.log('Using provided tokens from request');
          this.oauth2Client.setCredentials(tokens);
          calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
        } 
        // Method 2: Use stored tokens if available
        else {
          const storedTokens = this.getStoredTokens();
          if (storedTokens && storedTokens.access_token) {
            this.logger.log('Using stored tokens from memory');
            this.oauth2Client.setCredentials(storedTokens);
            calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
          } 
          // Method 3: Use service account authentication (server-to-server)
          else {
            this.logger.log('No user tokens available, using service account authentication');
            calendar = await this.googleCalendarAuthService.getServiceAccountClient();
          }
        }
      } catch (authError) {
        this.logger.error('Authentication setup error:', authError);
        // As a last resort, try direct OAuth client
        this.logger.log('Falling back to direct OAuth client');
        calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
      }
      
      // Format the event object according to Google Calendar API requirements
      const event = {
        summary: eventData.title,
        description: eventData.description,
        start: {
          dateTime: new Date(eventData.startTime).toISOString(),
          timeZone: eventData.timeZone || 'UTC',
        },
        end: {
          dateTime: new Date(eventData.endTime).toISOString(),
          timeZone: eventData.timeZone || 'UTC',
        },
        attendees: Array.isArray(eventData.attendees) 
          ? eventData.attendees.map((email: string) => ({ email })) 
          : [],
      };
      
      this.logger.log('Formatted event:', JSON.stringify(event));
      
      try {
        // Try to insert the event
        const response = await calendar.events.insert({
          calendarId,
          requestBody: event,
          sendUpdates: 'all', // Send email notifications to attendees
        });
        
        this.logger.log('Event created successfully:', response.data.htmlLink);
        return response.data;
      } catch (insertError: any) {
        this.logger.error('Error inserting event:', insertError.message);
        
        // For debugging purposes, log detailed error information
        if (insertError.response && insertError.response.data) {
          this.logger.error('Error details:', JSON.stringify(insertError.response.data));
        }
        
        // Check for invalid_grant error which is common with OAuth
        if (insertError.message === 'invalid_grant') {
          this.logger.error('Invalid grant error - OAuth token issue');
          throw new Error('OAuth authentication failed. Please complete the OAuth flow again with valid credentials.');
        }
        else if (insertError.code === 401 || (insertError.response && insertError.response.status === 401)) {
          this.logger.error('Authentication error - token may be invalid or expired');
          throw new Error('Google Calendar authentication failed. Please reconnect your account.');
        } else if (insertError.code === 403 || (insertError.response && insertError.response.status === 403)) {
          this.logger.error('Permission denied - check scopes and calendar access');
          throw new Error('Permission denied. Make sure you have granted the necessary permissions.');
        } else {
          throw new Error(`Failed to create event: ${insertError.message}`);
        }
      }
    } catch (error) {
      this.logger.error('Error creating Google Calendar event', error);
      throw error;
    }
  }

  async checkAvailability(startDate: string, endDate: string, calendarId = 'primary', tokens?: any) {
    try {
      const events = await this.getEvents(startDate, endDate, calendarId, tokens);
      
      // Simple availability check - consider a time period available if there are no events
      const isAvailable = events.length === 0;
      
      return {
        available: isAvailable,
        conflictingEvents: isAvailable ? [] : events,
      };
    } catch (error) {
      this.logger.error('Error checking Google Calendar availability', error);
      throw error;
    }
  }

  async getCalendars(tokens?: any) {
    try {
      if (tokens) {
        this.oauth2Client.setCredentials(tokens);
      }
      
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
      
      const response = await calendar.calendarList.list();
      
      return response.data.items;
    } catch (error) {
      this.logger.error('Error getting Google Calendar list', error);
      throw error;
    }
  }

  async getStatus() {
    try {
      // Check if we have the required OAuth credentials configured
      const clientId = this.configService.get('GOOGLE_CLIENT_ID');
      const clientSecret = this.configService.get('GOOGLE_CLIENT_SECRET');
      const storedTokens = this.getStoredTokens();
      
      const hasValidTokens = !!(clientId && clientSecret && storedTokens && storedTokens.access_token);
      
      return {
        connected: hasValidTokens,
        settings: hasValidTokens ? {
          calendarId: 'primary',
          checkAvailabilityEnabled: true,
          createEventsEnabled: true
        } : null,
        clientIdConfigured: !!clientId,
        clientSecretConfigured: !!clientSecret,
        tokensAvailable: !!(storedTokens && storedTokens.access_token)
      };
    } catch (error) {
      this.logger.error('Error checking Google Calendar status', error);
      return { connected: false, settings: null };
    }
  }

  async saveSettings(settings: any) {
    try {
      // In a real implementation, you would save these settings to your database
      // For now, we'll just return success
      this.logger.log('Saving Google Calendar settings', settings);
      
      // Mock implementation - in production, save to database
      return {
        success: true,
        settings
      };
    } catch (error) {
      this.logger.error('Error saving Google Calendar settings', error);
      throw error;
    }
  }

  async disconnect() {
    try {
      // In a real implementation, you would revoke the tokens and remove them from your database
      // For now, we'll just return success
      this.logger.log('Disconnecting Google Calendar');
      
      // Mock implementation - in production, revoke tokens and remove from database
      return {
        success: true
      };
    } catch (error) {
      this.logger.error('Error disconnecting Google Calendar', error);
      throw error;
    }
  }

  async testConnection() {
    try {
      const status = await this.getStatus();
      return {
        success: true,
        connected: status.connected,
        message: status.connected ? 'Successfully connected to Google Calendar' : 'Not connected to Google Calendar',
        status
      };
    } catch (error) {
      this.logger.error('Error testing Google Calendar connection:', error);
      return {
        success: false,
        connected: false,
        message: `Failed to test Google Calendar connection: ${error.message}`,
        error: error.message
      };
    }
  }

  async createTestEvent() {
    try {
      // Create a test event one hour from now
      const now = new Date();
      const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
      
      const testEvent = {
        title: 'New Event',
        description: 'This is a test event created at ' + now.toISOString(),
        startTime: now.toISOString(),
        endTime: oneHourLater.toISOString(),
        timeZone: 'UTC',
        attendees: []
      };
      
      this.logger.log('Creating test event:', JSON.stringify(testEvent));
      
      const result = await this.createEvent(testEvent, 'primary');
      
      return {
        success: true,
        message: 'Test event created successfully',
        event: result
      };
    } catch (error) {
      this.logger.error('Error creating test event:', error);
      return {
        success: false,
        message: `Failed to create test event: ${error.message}`,
        error: error.message
      };
    }
  }
}
