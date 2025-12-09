import { OnModuleInit } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../../../backend/src/core/database/prisma.service';
import { PublishWorkflowJobData } from '@jibu/queue-definitions';
import { N8nAdminClient } from './n8n-admin.client';
import { WebhookCacheService } from '@jibu/cache-utils';
export declare class PublishWorkflowProcessor implements OnModuleInit {
    private readonly prisma;
    private readonly n8nAdmin;
    private readonly webhookCache;
    private readonly logger;
    constructor(prisma: PrismaService, n8nAdmin: N8nAdminClient, webhookCache: WebhookCacheService);
    onModuleInit(): void;
    onActive(job: Job): void;
    onCompleted(job: Job, result: any): void;
    onFailed(job: Job, err: Error): void;
    handle(job: Job<PublishWorkflowJobData>): Promise<{
        n8nWorkflowId: string;
        activated: boolean;
        webhookUrl: string;
    }>;
    private isVoiceWorkflow;
    private delay;
}
