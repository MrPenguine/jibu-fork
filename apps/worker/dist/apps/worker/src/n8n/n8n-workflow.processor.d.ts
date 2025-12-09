import { Job } from 'bull';
import { WorkflowExecutionJobData, WorkflowStatusJobData, CancelWorkflowJobData } from '@jibu/queue-definitions';
import { N8nIntegrationService } from './n8n-integration.service';
import { N8nWorkerConfig } from './n8n-worker.config';
import { HttpService } from '@nestjs/axios';
export declare class N8nWorkflowProcessor {
    private readonly n8nIntegrationService;
    private readonly n8nWorkerConfig;
    private readonly httpService;
    private readonly logger;
    constructor(n8nIntegrationService: N8nIntegrationService, n8nWorkerConfig: N8nWorkerConfig, httpService: HttpService);
    handleExecuteWorkflow(job: Job<WorkflowExecutionJobData>): Promise<{
        executionId: any;
        status: string;
        executionTime: number;
    }>;
    handleCheckWorkflowStatus(job: Job<WorkflowStatusJobData>): Promise<{
        executionId: string;
        status: any;
        data: any;
    }>;
    handleCancelWorkflow(job: Job<CancelWorkflowJobData>): Promise<{
        executionId: string;
        status: string;
        reason: string;
    }>;
    private sendExecutionCallback;
}
