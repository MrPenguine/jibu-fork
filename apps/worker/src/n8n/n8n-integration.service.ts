import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

@Injectable()
export class N8nIntegrationService {
  private readonly logger = new Logger(N8nIntegrationService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.apiUrl = this.configService.get<string>('N8N_API_URL');
    this.apiKey = this.configService.get<string>('N8N_API_KEY');

    if (!this.apiUrl) {
      this.logger.error('N8N_API_URL not found in environment variables');
      throw new Error('N8N_API_URL is required for n8n integration');
    }

    if (!this.apiKey) {
      this.logger.error('N8N_API_KEY not found in environment variables');
      throw new Error('N8N_API_KEY is required for n8n integration');
    }
  }

  /**
   * Execute a workflow in n8n
   * @param workflowId The ID of the workflow to execute
   * @param data The data to pass to the workflow
   * @returns The execution ID and other execution details
   */
  async executeWorkflow(workflowId: string, data: any) {
    try {
      const response = await firstValueFrom(
        this.httpService
          .post(`${this.apiUrl}/workflows/${workflowId}/execute`, data, {
            headers: {
              'X-N8N-API-KEY': this.apiKey,
              'Content-Type': 'application/json',
            },
          })
          .pipe(
            map((response) => response.data),
            catchError((error) => {
              this.logger.error(
                `Failed to execute workflow ${workflowId}: ${error.message}`,
                error.stack,
              );
              throw new Error(`Failed to execute workflow: ${error.message}`);
            }),
          ),
      );

      this.logger.log(`Workflow ${workflowId} executed successfully`);
      return response;
    } catch (error) {
      this.logger.error(
        `Error executing workflow ${workflowId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get the status of a workflow execution
   * @param executionId The ID of the execution to check
   * @returns The execution status and details
   */
  async getExecutionStatus(executionId: string) {
    try {
      const response = await firstValueFrom(
        this.httpService
          .get(`${this.apiUrl}/executions/${executionId}`, {
            headers: {
              'X-N8N-API-KEY': this.apiKey,
            },
          })
          .pipe(
            map((response) => response.data),
            catchError((error) => {
              this.logger.error(
                `Failed to get execution status for ${executionId}: ${error.message}`,
                error.stack,
              );
              throw new Error(`Failed to get execution status: ${error.message}`);
            }),
          ),
      );

      return response;
    } catch (error) {
      this.logger.error(
        `Error getting execution status for ${executionId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Stop a running workflow execution
   * @param executionId The ID of the execution to stop
   * @returns The result of the stop operation
   */
  async stopExecution(executionId: string) {
    try {
      const response = await firstValueFrom(
        this.httpService
          .post(
            `${this.apiUrl}/executions/${executionId}/stop`,
            {},
            {
              headers: {
                'X-N8N-API-KEY': this.apiKey,
                'Content-Type': 'application/json',
              },
            },
          )
          .pipe(
            map((response) => response.data),
            catchError((error) => {
              this.logger.error(
                `Failed to stop execution ${executionId}: ${error.message}`,
                error.stack,
              );
              throw new Error(`Failed to stop execution: ${error.message}`);
            }),
          ),
      );

      this.logger.log(`Execution ${executionId} stopped successfully`);
      return response;
    } catch (error) {
      this.logger.error(
        `Error stopping execution ${executionId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get all workflows from n8n
   * @returns List of workflows
   */
  async getWorkflows() {
    try {
      const response = await firstValueFrom(
        this.httpService
          .get(`${this.apiUrl}/workflows`, {
            headers: {
              'X-N8N-API-KEY': this.apiKey,
            },
          })
          .pipe(
            map((response) => response.data),
            catchError((error) => {
              this.logger.error(
                `Failed to get workflows: ${error.message}`,
                error.stack,
              );
              throw new Error(`Failed to get workflows: ${error.message}`);
            }),
          ),
      );

      return response;
    } catch (error) {
      this.logger.error(
        `Error getting workflows: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Check if n8n is available and responding
   * @returns True if n8n is available, false otherwise
   */
  async healthCheck(): Promise<boolean> {
    try {
      await firstValueFrom(
        this.httpService
          .get(`${this.apiUrl}/health`, {
            headers: {
              'X-N8N-API-KEY': this.apiKey,
            },
          })
          .pipe(
            catchError((error) => {
              this.logger.error(
                `n8n health check failed: ${error.message}`,
                error.stack,
              );
              throw error;
            }),
          ),
      );
      
      return true;
    } catch (error) {
      this.logger.error(`n8n health check failed: ${error.message}`);
      return false;
    }
  }
}
