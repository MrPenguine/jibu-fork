import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';

@Injectable()
export class GoogleSheetsAuthService {
  private readonly logger = new Logger(GoogleSheetsAuthService.name);

  constructor(private configService: ConfigService) {}

  /**
   * Get an authenticated Google Sheets client using OAuth2
   */
  async getSheetsClient() {
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
      
      return google.sheets({ 
        version: 'v4', 
        auth: oauth2Client 
      });
    } catch (error) {
      this.logger.error('Error creating Google Sheets client:', error);
      throw error;
    }
  }

  /**
   * Get an authenticated Google Sheets client using JWT (service account)
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
      //   scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      // });
      // const client = await auth.getClient();
      
      // For now, we'll just use the OAuth2 client
      return this.getSheetsClient();
    } catch (error) {
      this.logger.error('Error creating service account client:', error);
      throw error;
    }
  }
}
