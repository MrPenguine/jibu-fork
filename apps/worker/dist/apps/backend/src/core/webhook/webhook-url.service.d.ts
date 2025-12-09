import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { WebhookCacheService } from '@jibu/cache-utils';
export declare class WebhookUrlService {
    private readonly prisma;
    private readonly configService;
    private readonly cacheService;
    private readonly logger;
    private readonly REFRESH_TIMEOUT_MS;
    constructor(prisma: PrismaService, configService: ConfigService, cacheService: WebhookCacheService);
    refreshWebhookUrl(workflowId: string): Promise<string | null>;
    resolveBaseUrl(): string;
    private cleanUrl;
    batchRefreshWebhookUrls(workflowIds: string[]): Promise<Map<string, string | null>>;
    getWebhookUrl(workflowId: string, isVoiceWorkflow?: boolean): Promise<string | null>;
    getWebhookUrlDirect(workflowId: string): Promise<string | null>;
    private isVoiceWorkflow;
    needsRefresh(workflowId: string, maxAgeMinutes?: number): Promise<boolean>;
}
