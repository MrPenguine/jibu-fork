import { Job } from 'bull';
import { DefaultJobData, EmailJobData } from '@jibu/queue-definitions';
export declare class QueueProcessor {
    private readonly logger;
    processDefaultJob(job: Job<DefaultJobData>): Promise<{
        success: boolean;
        jobId: import("bull").JobId;
    }>;
    processEmailJob(job: Job<EmailJobData>): Promise<{
        success: boolean;
        jobId: import("bull").JobId;
        recipient: string;
    }>;
}
