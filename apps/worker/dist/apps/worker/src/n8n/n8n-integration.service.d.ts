import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
export declare class N8nIntegrationService {
    private readonly configService;
    private readonly httpService;
    private readonly logger;
    private readonly apiUrl;
    private readonly apiKey;
    constructor(configService: ConfigService, httpService: HttpService);
    executeWorkflow(workflowId: string, data: any): Promise<any>;
    getExecutionStatus(executionId: string): Promise<any>;
    stopExecution(executionId: string): Promise<any>;
    getWorkflows(): Promise<any>;
    healthCheck(): Promise<boolean>;
}
