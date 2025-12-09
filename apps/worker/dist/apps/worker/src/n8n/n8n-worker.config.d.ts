import { ConfigService } from '@nestjs/config';
export declare class N8nWorkerConfig {
    private readonly configService;
    private readonly logger;
    constructor(configService: ConfigService);
    getRedisConfig(): {
        host: any;
        port: number;
        password: any;
    };
    getQueueConfig(): {
        prefix: string;
        defaultJobOptions: {
            attempts: number;
            backoff: {
                type: string;
                delay: number;
            };
            removeOnComplete: boolean;
            removeOnFail: boolean;
        };
        limiter: {
            max: number;
            duration: number;
        };
    };
    getN8nApiConfig(): {
        url: any;
        key: any;
    };
    getWorkerConcurrency(): number;
    getWorkerTimeout(): number;
    getWorkerRetryAttempts(): number;
    getWorkerMemoryLimit(): number;
    getMinWorkers(): number;
    getMaxWorkers(): number;
    getQueueThreshold(): number;
    getWorkerConfig(): {
        redis: {
            host: any;
            port: number;
            password: any;
        };
        queue: {
            prefix: string;
            defaultJobOptions: {
                attempts: number;
                backoff: {
                    type: string;
                    delay: number;
                };
                removeOnComplete: boolean;
                removeOnFail: boolean;
            };
            limiter: {
                max: number;
                duration: number;
            };
        };
        n8n: {
            url: any;
            key: any;
        };
        worker: {
            concurrency: number;
            timeout: number;
            retryAttempts: number;
            memoryLimit: number;
            minWorkers: number;
            maxWorkers: number;
            queueThreshold: number;
        };
    };
}
