import { OnModuleInit } from '@nestjs/common';
import { Job } from 'bull';
import { ConfigService } from '@nestjs/config';
import { WebhookPayload } from '@jibu/queue-definitions';
import { WebhookCacheService } from '@jibu/cache-utils';
import { WebhookUrlService } from '../../../backend/src/core/webhook/webhook-url.service';
export declare class WebhookDeliveryProcessor implements OnModuleInit {
    private readonly webhookCacheService;
    private readonly configService;
    private readonly webhookUrlService;
    private readonly logger;
    private readonly WEBHOOK_TIMEOUT_MS;
    private readonly FALLBACK_MESSAGE;
    private readonly failureCount;
    private readonly circuitBreakerThreshold;
    private readonly circuitBreakerResetTime;
    private deliveryCount;
    private failureCountTotal;
    private fallbackCount;
    private totalDeliveryTime;
    constructor(webhookCacheService: WebhookCacheService, configService: ConfigService, webhookUrlService: WebhookUrlService);
    onModuleInit(): void;
    onActive(job: Job<WebhookPayload>): void;
    onCompleted(job: Job<WebhookPayload>, result: any): void;
    onFailed(job: Job<WebhookPayload>, err: Error): void;
    handle(job: Job<WebhookPayload>): Promise<{
        fallback: boolean;
        message: string;
        success?: undefined;
        deliveryTime?: undefined;
        totalTime?: undefined;
        response?: undefined;
    } | {
        success: boolean;
        deliveryTime: number;
        totalTime: number;
        response: any;
        fallback?: undefined;
        message?: undefined;
    }>;
    private getWebhookUrl;
    private deliverWebhook;
    private normalizeWebhookUrl;
    private shouldTriggerCircuitBreaker;
    private incrementFailureCount;
    private resetCircuitBreaker;
    private logMetrics;
}
