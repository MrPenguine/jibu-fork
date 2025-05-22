import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { google } from 'googleapis';
import { PrismaService } from '../../../../core/database/prisma.service';
import { GoogleCalendarAuthService } from './google-calendar-auth.service';

// Type declaration to handle the PrismaService extensions
declare module '../../../../core/database/prisma.service' {
  interface PrismaService {
    Tool: any;
    Credential: any;
  }
}

// Define metadata interface to fix TypeScript errors
interface ConnectionMetadata {
  calendarId?: string;
  userId?: string;
  scope?: string;
  connectedAt?: string;
  [key: string]: any;
}

// Define event data interface
interface EventData {
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime: string;
    timeZone?: string;
  };
  end: {
    dateTime: string;
    timeZone?: string;
  };
  attendees?: Array<{ email: string }>;
  [key: string]: any;
}

// Define connection status interface
interface ConnectionStatus {
  connected: boolean;
  credentialId?: string;
  metadata?: ConnectionMetadata;
  error?: string;
}

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);
  private oauth2Client;
  // Store tokens in memory for demo/fallback purposes
  private static tokensStore: any = null;

  constructor(
    private configService: ConfigService,
    private googleCalendarAuthService: GoogleCalendarAuthService,
    private prisma: PrismaService
  ) {
    this.oauth2Client = new google.auth.OAuth2(
      this.configService.get('GOOGLE_CLIENT_ID'),
      this.configService.get('GOOGLE_CLIENT_SECRET'),
      this.configService.get('GOOGLE_REDIRECT_URI') || 'http://localhost:3000/api/auth/callback/google',
    );
  }

  private storeTokensInMemory(tokens: any) {
    this.logger.log('Storing tokens in memory');
    GoogleCalendarService.tokensStore = tokens;
  }

  private getStoredTokens() {
    return GoogleCalendarService.tokensStore;
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

  async handleCallback(code: string, organizationId: string, userId: string) {
    try {
      this.logger.log(`Processing OAuth callback with code: ${code.substring(0, 10)}...`);
      
      // Exchange the code for tokens
      const { tokens } = await this.oauth2Client.getToken(code);
      
      this.logger.log('Successfully exchanged code for tokens');
      this.logger.log(`Storing tokens for organization ${organizationId} and user ${userId}`);
      
      // Store the tokens in memory as a fallback
      this.storeTokensInMemory(tokens);
      
      try {
        // Check if a credential already exists for this organization
        const existingCredential = await this.prisma.Credential.findFirst({
          where: {
            organizationId,
            provider: 'google',
            type: 'google.calendar'
          }
        });
        
        let credentialId: string;
        
        if (existingCredential) {
          // Update the existing credential
          this.logger.log(`Updating existing credential with ID: ${existingCredential.id}`);
          
          await this.prisma.Credential.update({
            where: { id: existingCredential.id },
            data: {
              encryptedCredentials: JSON.stringify(tokens),
              metadata: {
                userId,
                scope: tokens.scope,
                connectedAt: new Date().toISOString()
              }
            }
          });
          
          credentialId = existingCredential.id;
        } else {
          // Create a new credential
          this.logger.log('Creating new credential');
          
          const newCredential = await this.prisma.Credential.create({
            data: {
              id: randomUUID(),
              organizationId,
              provider: 'google',
              type: 'google.calendar',
              name: 'Google Calendar',
              encryptedCredentials: JSON.stringify(tokens),
              metadata: {
                userId,
                scope: tokens.scope,
                connectedAt: new Date().toISOString()
              },
              userId
            }
          });
          
          this.logger.log(`Created new credential with ID: ${newCredential.id}`);
          credentialId = newCredential.id;
        }
        
        // Create or update the Google Calendar tool
        const existingTool = await this.prisma.Tool.findFirst({
          where: {
            organizationId,
            type: 'google.calendar.availability.check'
          }
        });
        
        if (existingTool) {
          // Update existing tool
          this.logger.log(`Updating existing tool with ID: ${existingTool.id}`);
          
          await this.prisma.Tool.update({
            where: { id: existingTool.id },
            data: {
              credentialId,
              updatedAt: new Date()
            }
          });
        } else {
          // Create a new tool
          this.logger.log('Creating new Google Calendar tool');
          
          const newTool = await this.prisma.Tool.create({
            data: {
              id: randomUUID(),
              organizationId,
              name: 'google_calendar_check_availability_tool',
              description: 'Check availability in Google Calendar',
              type: 'google.calendar.availability.check',
              function: {
                name: 'google_calendar_check_availability',
                parameters: {
                  type: 'object',
                  properties: {
                    startTime: {
                      type: 'string',
                      format: 'date-time'
                    },
                    endTime: {
                      type: 'string',
                      format: 'date-time'
                    }
                  },
                  required: ['startTime', 'endTime']
                }
              },
              credentialId,
              metadata: {
                calendarId: 'primary' // Default to primary calendar
              }
            }
          });
          
          this.logger.log(`Created new tool with ID: ${newTool.id}`);
        }
        
        return { success: true };
      } catch (dbError) {
        this.logger.error('Error storing tokens in database:', dbError);
        return { success: false, error: dbError.message };
      }
    } catch (error) {
      this.logger.error('Error handling callback:', error);
      return { success: false, error: error.message };
    }
  }
  
  async getConnectionStatus(organizationId: string): Promise<ConnectionStatus> {
    try {
      this.logger.log(`Checking connection status for org ${organizationId}`);
      
      // Find the Google Calendar tool
      const tool = await this.prisma.Tool.findFirst({
        where: {
          organizationId,
          type: 'google.calendar.availability.check'
        }
      });
      
      if (!tool) {
        this.logger.log('No Google Calendar tool found');
        return { connected: false };
      }
      
      // Find the associated credential
      const credential = await this.prisma.Credential.findUnique({
        where: { id: tool.credentialId }
      });
      
      if (!credential) {
        this.logger.log('No credential found for the tool');
        return { connected: false };
      }
      
      // Return the connection status
      return {
        connected: true,
        credentialId: credential.id,
        metadata: credential.metadata as ConnectionMetadata
      };
    } catch (error) {
      this.logger.error('Error checking connection status:', error);
      return { connected: false, error: error.message };
    }
  }
  
  async disconnect(organizationId: string) {
    try {
      this.logger.log(`Disconnecting Google Calendar for org ${organizationId}`);
      
      // Find the Google Calendar tool
      const tool = await this.prisma.Tool.findFirst({
        where: {
          organizationId,
          type: 'google.calendar.availability.check'
        }
      });
      
      if (!tool) {
        this.logger.log('No Google Calendar tool found to disconnect');
        return { success: true };
      }
      
      // Delete the credential
      if (tool.credentialId) {
        await this.prisma.Credential.delete({
          where: { id: tool.credentialId }
        });
      }
      
      // Delete the tool
      await this.prisma.Tool.delete({
        where: { id: tool.id }
      });
      
      // Clear the in-memory tokens
      GoogleCalendarService.tokensStore = null;
      
      this.logger.log('Successfully disconnected Google Calendar');
      return { success: true };
    } catch (error) {
      this.logger.error('Error disconnecting Google Calendar:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Get events from Google Calendar
   */
  async getEvents(startTime: string, endTime: string, organizationId: string) {
    try {
      this.logger.log(`Getting events from ${startTime} to ${endTime} for org ${organizationId}`);
      
      // Get the connection status to check if we have credentials
      const connectionStatus = await this.getConnectionStatus(organizationId);
      
      if (!connectionStatus.connected) {
        throw new Error('Not connected to Google Calendar');
      }
      
      // Get the credential
      const credential = await this.prisma.Credential.findUnique({
        where: { id: connectionStatus.credentialId }
      });
      
      if (!credential) {
        throw new Error('Credential not found');
      }
      
      // Parse the credentials
      const tokens = JSON.parse(credential.encryptedCredentials);
      
      // Set up the OAuth client with the tokens
      this.oauth2Client.setCredentials(tokens);
      
      // Create a calendar client
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
      
      // Get the calendar ID from the tool metadata or use primary
      const calendarId = (connectionStatus.metadata as ConnectionMetadata)?.calendarId || 'primary';
      
      // Get events
      const response = await calendar.events.list({
        calendarId,
        timeMin: startTime,
        timeMax: endTime,
        singleEvents: true,
        orderBy: 'startTime',
      });
      
      return {
        events: response.data.items,
        calendarId,
        timeZone: response.data.timeZone
      };
    } catch (error) {
      this.logger.error('Error getting events:', error);
      throw error;
    }
  }
  
  /**
   * Create an event in Google Calendar
   */
  async createEvent(eventData: EventData, organizationId: string) {
    try {
      this.logger.log(`Creating event "${eventData.summary}" for org ${organizationId}`);
      
      // Get the connection status to check if we have credentials
      const connectionStatus = await this.getConnectionStatus(organizationId);
      
      if (!connectionStatus.connected) {
        throw new Error('Not connected to Google Calendar');
      }
      
      // Get the credential
      const credential = await this.prisma.Credential.findUnique({
        where: { id: connectionStatus.credentialId }
      });
      
      if (!credential) {
        throw new Error('Credential not found');
      }
      
      // Parse the credentials
      const tokens = JSON.parse(credential.encryptedCredentials);
      
      // Set up the OAuth client with the tokens
      this.oauth2Client.setCredentials(tokens);
      
      // Create a calendar client
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
      
      // Get the calendar ID from the tool metadata or use primary
      const calendarId = (connectionStatus.metadata as ConnectionMetadata)?.calendarId || 'primary';
      
      // Create the event
      const response = await calendar.events.insert({
        calendarId,
        requestBody: eventData
      });
      
      return {
        event: response.data,
        calendarId
      };
    } catch (error) {
      this.logger.error('Error creating event:', error);
      throw error;
    }
  }
  
  /**
   * Check availability in Google Calendar
   */
  async checkAvailability(startTime: string, endTime: string, organizationId: string) {
    try {
      this.logger.log(`Checking availability from ${startTime} to ${endTime} for org ${organizationId}`);
      
      // Get events during the specified time period
      const { events } = await this.getEvents(startTime, endTime, organizationId);
      
      // If there are no events, the time is available
      if (!events || events.length === 0) {
        return {
          available: true,
          events: []
        };
      }
      
      // Check if any events overlap with the requested time
      const requestedStart = new Date(startTime).getTime();
      const requestedEnd = new Date(endTime).getTime();
      
      const overlappingEvents = events.filter(event => {
        const eventStart = new Date(event.start.dateTime || event.start.date).getTime();
        const eventEnd = new Date(event.end.dateTime || event.end.date).getTime();
        
        // Check for overlap
        return (eventStart < requestedEnd) && (eventEnd > requestedStart);
      });
      
      return {
        available: overlappingEvents.length === 0,
        events: overlappingEvents.map(event => ({
          id: event.id,
          summary: event.summary,
          start: event.start,
          end: event.end
        }))
      };
    } catch (error) {
      this.logger.error('Error checking availability:', error);
      throw error;
    }
  }
  
  /**
   * Test endpoint for Google Calendar
   */
  async test() {
    try {
      this.logger.log('Testing Google Calendar API');
      
      // Check if the client ID and secret are configured
      const clientId = this.configService.get('GOOGLE_CLIENT_ID');
      const clientSecret = this.configService.get('GOOGLE_CLIENT_SECRET');
      
      if (!clientId || !clientSecret) {
        return {
          success: false,
          message: 'Google Calendar API credentials not configured',
          config: {
            clientId: clientId ? 'Configured' : 'Missing',
            clientSecret: clientSecret ? 'Configured' : 'Missing',
          }
        };
      }
      
      return {
        success: true,
        message: 'Google Calendar API credentials are configured',
        config: {
          clientId: clientId ? 'Configured' : 'Missing',
          clientSecret: clientSecret ? 'Configured' : 'Missing',
        }
      };
    } catch (error) {
      this.logger.error('Error testing Google Calendar API:', error);
      return {
        success: false,
        message: `Error testing Google Calendar API: ${error.message}`,
        error: error.message
      };
    }
  }
}
