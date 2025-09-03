import { Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bull';
import { QUEUE_NAMES, JOB_NAMES, WorkflowExecutionJobData, WorkflowStatusJobData, CancelWorkflowJobData } from '@jibu/queue-definitions';
import { N8nIntegrationService } from './n8n-integration.service';
import { N8nWorkerConfig } from './n8n-worker.config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable()
@Processor(QUEUE_NAMES.WORKFLOW_EXECUTION)
export class N8nWorkflowProcessor {
  private readonly logger = new Logger(N8nWorkflowProcessor.name);

  constructor(
    private readonly n8nIntegrationService: N8nIntegrationService,
    private readonly n8nWorkerConfig: N8nWorkerConfig,
    private readonly httpService: HttpService,
  ) {}

  @Process(JOB_NAMES.EXECUTE_WORKFLOW)
  async handleExecuteWorkflow(job: Job<WorkflowExecutionJobData>) {
    this.logger.log(`Processing workflow execution job ${job.id} for workflow ${job.data.workflowId}`);
    
    try {
      const startTime = Date.now();
      
      // Execute the workflow in n8n
      const executionResult = await this.n8nIntegrationService.executeWorkflow(
        job.data.workflowId,
        {
          workflowData: {
            organizationId: job.data.organizationId,
            userId: job.data.userId,
            input: job.data.input || {},
            jobId: job.id.toString(),
          }
        }
      );
      
      const executionTime = (Date.now() - startTime) / 1000;
      this.logger.log(`Workflow ${job.data.workflowId} executed in ${executionTime}s with execution ID: ${executionResult.executionId}`);
      
      // If a callback URL was provided, notify about the execution
      if (job.data.callbackUrl) {
        await this.sendExecutionCallback(job.data.callbackUrl, {
          status: 'completed',
          executionId: executionResult.executionId,
          workflowId: job.data.workflowId,
          organizationId: job.data.organizationId,
          jobId: job.id.toString(),
          executionTime,
          result: executionResult,
        });
      }
      
      return {
        executionId: executionResult.executionId,
        status: 'completed',
        executionTime,
      };
    } catch (error) {
      this.logger.error(
        `Error executing workflow ${job.data.workflowId}: ${error.message}`,
        error.stack,
      );
      
      // If a callback URL was provided, notify about the failure
      if (job.data.callbackUrl) {
        await this.sendExecutionCallback(job.data.callbackUrl, {
          status: 'failed',
          error: error.message,
          workflowId: job.data.workflowId,
          organizationId: job.data.organizationId,
          jobId: job.id.toString(),
        });
      }
      
      throw error;
    }
  }

  @Process(JOB_NAMES.CHECK_WORKFLOW_STATUS)
  async handleCheckWorkflowStatus(job: Job<WorkflowStatusJobData>) {
    this.logger.log(`Checking status for workflow execution ${job.data.executionId}`);
    
    try {
      const status = await this.n8nIntegrationService.getExecutionStatus(job.data.executionId);
      
      return {
        executionId: job.data.executionId,
        status: status.status,
        data: status,
      };
    } catch (error) {
      this.logger.error(
        `Error checking workflow status for execution ${job.data.executionId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Process(JOB_NAMES.CANCEL_WORKFLOW)
  async handleCancelWorkflow(job: Job<CancelWorkflowJobData>) {
    this.logger.log(`Cancelling workflow execution ${job.data.executionId}`);
    
    try {
      await this.n8nIntegrationService.stopExecution(job.data.executionId);
      
      return {
        executionId: job.data.executionId,
        status: 'cancelled',
        reason: job.data.reason || 'Cancelled by user',
      };
    } catch (error) {
      this.logger.error(
        `Error cancelling workflow execution ${job.data.executionId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Send a callback to notify about workflow execution status
   */
  private async sendExecutionCallback(callbackUrl: string, data: any): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService
          .post(callbackUrl, data)
          .pipe(
            catchError((error) => {
              this.logger.error(
                `Failed to send execution callback to ${callbackUrl}: ${error.message}`,
                error.stack,
              );
              throw error;
            }),
          ),
      );
      
      this.logger.log(`Execution callback sent to ${callbackUrl}`);
    } catch (error) {
      this.logger.error(`Error sending execution callback: ${error.message}`);
      // We don't want to fail the job if the callback fails
    }
  }
}
