import { Injectable, Logger } from '@nestjs/common';
import { N8nConfigService } from './n8n-config.service';
import { HttpService } from '@nestjs/axios';
import { catchError, firstValueFrom } from 'rxjs';

/**
 * Service to test the connection to n8n
 * This can be used to verify that the n8n server is accessible
 * and that the API key is valid
 */
@Injectable()
export class N8nConnectionTestService {
  private readonly logger = new Logger(N8nConnectionTestService.name);

  constructor(
    private readonly n8nConfigService: N8nConfigService,
    private readonly httpService: HttpService,
  ) {}

  /**
   * Test the connection to n8n
   * @returns True if the connection is successful, false otherwise
   */
  async testConnection(): Promise<boolean> {
    try {
      this.logger.log('Testing connection to n8n...');
      
      const baseUrl = this.n8nConfigService.getBaseUrl();
      this.logger.log(`Using n8n base URL: ${baseUrl}`);
      
      const headers = {
        'X-N8N-API-KEY': this.n8nConfigService.getApiKey(),
        'Content-Type': 'application/json',
      };
      
      this.logger.log('Sending test request to n8n health endpoint...');
      
      const { data } = await firstValueFrom(
        this.httpService
          .get(`${baseUrl}/health`, { headers })
          .pipe(
            catchError((error) => {
              this.logger.error(`Error connecting to n8n: ${error.message}`);
              if (error.code === 'ECONNREFUSED') {
                this.logger.error(`Connection refused. Is n8n running at ${baseUrl}?`);
              } else if (error.response) {
                this.logger.error(`Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}`);
              }
              throw error;
            }),
          ),
      );
      
      this.logger.log(`Connection successful! Response: ${JSON.stringify(data)}`);
      return true;
    } catch (error) {
      this.logger.error(`Connection test failed: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Get environment variables related to n8n
   * @returns Object containing environment variables
   */
  getEnvironmentInfo(): Record<string, string | undefined> {
    return {
      N8N_BASE_URL: process.env.N8N_BASE_URL,
      N8N_API_KEY: process.env.N8N_API_KEY ? '[REDACTED]' : undefined,
      N8N_WEBHOOK_BASE_URL: process.env.N8N_WEBHOOK_BASE_URL,
      NODE_ENV: process.env.NODE_ENV,
    };
  }
}
