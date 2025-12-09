import { ConfigService } from '@nestjs/config';
import { Queue } from 'bull';
export declare class DeadLetterService {
    private readonly configService;
    private workflowQueue;
    private readonly logger;
    private readonly deadLetterQueueName;
    private readonly maxRetries;
    constructor(configService: ConfigService, workflowQueue: Queue);
    processFailedJob(queueName: string, jobId: string, error: Error, jobData: any): Promise<void>;
    private addToDeadLetterQueue;
    private logDeadLetterJob;
    retryDeadLetterJob(deadLetterJobId: string): Promise<boolean>;
}
