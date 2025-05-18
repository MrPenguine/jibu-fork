import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';

@Injectable()
export class GoogleCalendarAuthService {
  private readonly logger = new Logger(GoogleCalendarAuthService.name);

  constructor(private configService: ConfigService) {}

  /**
   * Get an authenticated Google Calendar client using OAuth2
   */
  async getCalendarClient() {
    try {
      const oauth2Client = new google.auth.OAuth2(
        this.configService.get('GOOGLE_CLIENT_ID'),
        this.configService.get('GOOGLE_CLIENT_SECRET'),
        this.configService.get('GOOGLE_REDIRECT_URI'),
      );

      this.logger.log('Created OAuth2 client with client ID:', 
        this.configService.get('GOOGLE_CLIENT_ID')?.substring(0, 10) + '...');

      // For testing purposes, we'll use a direct approach
      // In production, you would use user-specific tokens from a database
      
      return google.calendar({ 
        version: 'v3', 
        auth: oauth2Client 
      });
    } catch (error) {
      this.logger.error('Error creating Google Calendar client:', error);
      throw error;
    }
  }

  /**
   * Get an authenticated Google Calendar client using JWT (service account)
   * This is useful for server-to-server applications without user interaction
   */
  async getServiceAccountClient() {
    try {
      // For a real implementation, you would use a service account key file
      // For now, we'll just log that this method was called
      this.logger.log('Service account authentication requested');
      
      // Create a JWT client - in a real implementation, you would use:
      // const auth = new google.auth.GoogleAuth({
      //   keyFile: 'path/to/service-account-key.json',
      //   scopes: ['https://www.googleapis.com/auth/calendar'],
      // });
      // const client = await auth.getClient();
      
      // For now, we'll just use the OAuth2 client
      return this.getCalendarClient();
    } catch (error) {
      this.logger.error('Error creating service account client:', error);
      throw error;
    }
  }
}
