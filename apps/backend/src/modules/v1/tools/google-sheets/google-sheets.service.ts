import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { ConfigService } from '@nestjs/config';
import { GoogleSheetsAuthService } from './google-sheets-auth.service';

@Injectable()
export class GoogleSheetsService {
  private readonly logger = new Logger(GoogleSheetsService.name);
  private oauth2Client;

  constructor(
    private configService: ConfigService,
    private googleSheetsAuthService: GoogleSheetsAuthService
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
      
      // Define the required scopes for Google Sheets
      const scopes = [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.readonly',
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
      this.logger.error('Error handling Google Sheets callback', error);
      throw error;
    }
  }
  
  // In-memory token storage for demo purposes
  private static tokensStore = null;
  
  private storeTokensInMemory(tokens) {
    this.logger.log('Storing tokens in memory');
    GoogleSheetsService.tokensStore = tokens;
  }
  
  private getStoredTokens() {
    return GoogleSheetsService.tokensStore;
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

  async getSpreadsheets(tokens?: any) {
    try {
      if (tokens) {
        this.oauth2Client.setCredentials(tokens);
      } else {
        const storedTokens = this.getStoredTokens();
        if (storedTokens) {
          this.oauth2Client.setCredentials(storedTokens);
        }
      }
      
      const drive = google.drive({ version: 'v3', auth: this.oauth2Client });
      
      const response = await drive.files.list({
        q: "mimeType='application/vnd.google-apps.spreadsheet'",
        fields: 'files(id, name, createdTime, modifiedTime, webViewLink)',
      });
      
      return response.data.files;
    } catch (error) {
      this.logger.error('Error getting Google Sheets spreadsheets', error);
      throw error;
    }
  }

  async getSheets(spreadsheetId: string, tokens?: any) {
    try {
      if (tokens) {
        this.oauth2Client.setCredentials(tokens);
      } else {
        const storedTokens = this.getStoredTokens();
        if (storedTokens) {
          this.oauth2Client.setCredentials(storedTokens);
        }
      }
      
      const sheets = google.sheets({ version: 'v4', auth: this.oauth2Client });
      
      const response = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets.properties',
      });
      
      return response.data.sheets.map(sheet => sheet.properties);
    } catch (error) {
      this.logger.error(`Error getting sheets for spreadsheet ${spreadsheetId}`, error);
      throw error;
    }
  }

  async getValues(spreadsheetId: string, range: string, tokens?: any) {
    try {
      if (tokens) {
        this.oauth2Client.setCredentials(tokens);
      } else {
        const storedTokens = this.getStoredTokens();
        if (storedTokens) {
          this.oauth2Client.setCredentials(storedTokens);
        }
      }
      
      const sheets = google.sheets({ version: 'v4', auth: this.oauth2Client });
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });
      
      return {
        range: response.data.range,
        values: response.data.values || [],
      };
    } catch (error) {
      this.logger.error(`Error getting values for spreadsheet ${spreadsheetId} range ${range}`, error);
      throw error;
    }
  }

  async updateValues(spreadsheetId: string, range: string, values: any[][], tokens?: any) {
    try {
      if (tokens) {
        this.oauth2Client.setCredentials(tokens);
      } else {
        const storedTokens = this.getStoredTokens();
        if (storedTokens) {
          this.oauth2Client.setCredentials(storedTokens);
        }
      }
      
      const sheets = google.sheets({ version: 'v4', auth: this.oauth2Client });
      
      const response = await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values,
        },
      });
      
      return {
        updatedRange: response.data.updatedRange,
        updatedRows: response.data.updatedRows,
        updatedCells: response.data.updatedCells,
      };
    } catch (error) {
      this.logger.error(`Error updating values for spreadsheet ${spreadsheetId} range ${range}`, error);
      throw error;
    }
  }

  /**
   * Append values to a spreadsheet range
   * @param spreadsheetId The ID of the spreadsheet
   * @param range The range to append to (e.g., Sheet1!A:Z)
   * @param values The values to append
   * @param tokens Optional OAuth tokens
   * @returns Information about the append operation
   */
  async appendValues(spreadsheetId: string, range: string, values: any[][], tokens?: any) {
    try {
      this.logger.log(`Appending values to spreadsheet ${spreadsheetId} range ${range}`);
      this.logger.log(`Values to append: ${JSON.stringify(values)}`);
      
      if (tokens) {
        this.oauth2Client.setCredentials(tokens);
      } else {
        const storedTokens = this.getStoredTokens();
        if (storedTokens) {
          this.oauth2Client.setCredentials(storedTokens);
        }
      }
      
      const sheets = google.sheets({ version: 'v4', auth: this.oauth2Client });
      
      const response = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values,
        },
      });
      
      this.logger.log(`Successfully appended values to ${response.data.updates?.updatedRange}`);
      
      return {
        updatedRange: response.data.updates?.updatedRange,
        updatedRows: response.data.updates?.updatedRows,
        updatedCells: response.data.updates?.updatedCells,
      };
    } catch (error) {
      this.logger.error(`Error appending values to spreadsheet ${spreadsheetId} range ${range}`, error);
      throw error;
    }
  }

  async createSpreadsheet(title: string, sheets?: { title: string }[], tokens?: any) {
    try {
      if (tokens) {
        this.oauth2Client.setCredentials(tokens);
      } else {
        const storedTokens = this.getStoredTokens();
        if (storedTokens) {
          this.oauth2Client.setCredentials(storedTokens);
        }
      }
      
      const sheetsApi = google.sheets({ version: 'v4', auth: this.oauth2Client });
      
      // Create a new spreadsheet
      const resource = {
        properties: {
          title,
        },
        sheets: sheets ? sheets.map(sheet => ({ properties: sheet })) : undefined,
      };
      
      const response = await sheetsApi.spreadsheets.create({
        requestBody: resource,
      });
      
      return response.data;
    } catch (error) {
      this.logger.error('Error creating spreadsheet', error);
      throw error;
    }
  }

  async testConnection() {
    try {
      // Check if credentials are configured
      const clientId = this.configService.get('GOOGLE_CLIENT_ID');
      const clientSecret = this.configService.get('GOOGLE_CLIENT_SECRET');
      const redirectUri = this.configService.get('GOOGLE_REDIRECT_URI');
      
      const clientIdConfigured = !!clientId;
      const clientSecretConfigured = !!clientSecret;
      const redirectUriConfigured = !!redirectUri;
      
      // Check if we have tokens stored
      const tokensAvailable = !!this.getStoredTokens();
      
      // Try to get a list of spreadsheets if we have tokens
      let connected = false;
      let spreadsheets = [];
      
      if (tokensAvailable) {
        try {
          spreadsheets = await this.getSpreadsheets();
          connected = true;
        } catch (error) {
          this.logger.error('Error testing connection', error);
          connected = false;
        }
      }
      
      return {
        clientIdConfigured,
        clientSecretConfigured,
        redirectUriConfigured,
        tokensAvailable,
        connected,
        spreadsheets: connected ? spreadsheets : [],
      };
    } catch (error) {
      this.logger.error('Error testing connection', error);
      throw error;
    }
  }

  async createTestSpreadsheet() {
    try {
      // Create a test spreadsheet with some sample data
      const title = `Test Spreadsheet - ${new Date().toISOString()}`;
      
      const spreadsheet = await this.createSpreadsheet(title, [
        { title: 'Sheet1' },
        { title: 'Sheet2' },
      ]);
      
      // Add some sample data to the first sheet
      const sampleData = [
        ['Name', 'Email', 'Phone'],
        ['John Doe', 'john@example.com', '123-456-7890'],
        ['Jane Smith', 'jane@example.com', '987-654-3210'],
        ['Bob Johnson', 'bob@example.com', '555-123-4567'],
      ];
      
      await this.updateValues(spreadsheet.spreadsheetId, 'Sheet1!A1:C4', sampleData);
      
      return {
        spreadsheetId: spreadsheet.spreadsheetId,
        spreadsheetUrl: spreadsheet.spreadsheetUrl,
        title,
        message: 'Test spreadsheet created successfully',
      };
    } catch (error) {
      this.logger.error('Error creating test spreadsheet', error);
      throw error;
    }
  }

  async saveSettings(settings: any) {
    // In a real implementation, you would save these settings to a database
    this.logger.log('Saving Google Sheets settings:', settings);
    return { success: true, settings };
  }

  async disconnect() {
    try {
      // Clear the stored tokens
      GoogleSheetsService.tokensStore = null;
      
      return { success: true, message: 'Google Sheets disconnected successfully' };
    } catch (error) {
      this.logger.error('Error disconnecting Google Sheets', error);
      throw error;
    }
  }
}
