import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bull';
import { N8nWorkerConfig } from '../n8n/n8n-worker.config';
export declare class ScalingService implements OnModuleInit {
    private readonly configService;
    private readonly n8nWorkerConfig;
    private workflowQueue;
    private webhookQueue;
    private readonly logger;
    private currentWorkers;
    private readonly minWorkers;
    private readonly maxWorkers;
    private readonly queueThreshold;
    private readonly scalingEnabled;
    constructor(configService: ConfigService, n8nWorkerConfig: N8nWorkerConfig, workflowQueue: Queue, webhookQueue: Queue);
    onModuleInit(): void;
    monitorQueue(): Promise<void>;
    private getWorkflowQueueMetrics;
    private getWebhookQueueMetrics;
    private getQueueLength;
    private getActiveJobCount;
    private getWaitingJobCount;
    private scaleUp;
    private scaleDown;
    private applyScaling;
}
