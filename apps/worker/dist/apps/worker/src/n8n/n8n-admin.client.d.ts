import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
export declare class N8nAdminClient {
    private readonly configService;
    private readonly http;
    private readonly logger;
    private readonly apiBase;
    private readonly apiKey;
    constructor(configService: ConfigService, http: HttpService);
    private headers;
    createWorkflow(workflow: any): Promise<any>;
    updateWorkflow(id: string, workflow: any): Promise<any>;
    getWorkflow(id: string): Promise<any>;
    private isNotFound;
    workflowExists(id: string): Promise<boolean>;
    setActive(id: string, active: boolean): Promise<any>;
    listWorkflows(params?: {
        name?: string;
        limit?: number;
    }): Promise<any>;
    findWorkflowByName(name: string): Promise<any | null>;
}
