"use strict";
var WebhookUrlService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookUrlService = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../database/prisma.service");
const cache_utils_1 = require("@jibu/cache-utils");
let WebhookUrlService = WebhookUrlService_1 = class WebhookUrlService {
    constructor(prisma, configService, cacheService) {
        this.prisma = prisma;
        this.configService = configService;
        this.cacheService = cacheService;
        this.logger = new common_1.Logger(WebhookUrlService_1.name);
        this.REFRESH_TIMEOUT_MS = 2000;
    }
    async refreshWebhookUrl(workflowId) {
        var _a;
        const startTime = Date.now();
        try {
            const workflow = await this.prisma.workflow.findUnique({
                where: { id: workflowId },
                include: { n8nWorkflow: true },
            });
            if (!workflow) {
                this.logger.warn(`Workflow not found: ${workflowId}`);
                return null;
            }
            if (!workflow.n8nWorkflow) {
                this.logger.warn(`No n8n workflow linked for workflow: ${workflowId}`);
                return null;
            }
            if (!workflow.n8nWorkflow.n8nWorkflowId) {
                this.logger.warn(`Workflow ${workflowId} has no published version (no n8nWorkflowId)`);
                return null;
            }
            const workflowJson = workflow.n8nWorkflow.workflowJson;
            if (!workflowJson || !workflowJson.nodes) {
                this.logger.warn(`No workflow JSON found for workflow: ${workflowId}`);
                return null;
            }
            const webhookNode = workflowJson.nodes.find((node) => node.type === 'n8n-nodes-base.webhook');
            if (!webhookNode || !((_a = webhookNode.parameters) === null || _a === void 0 ? void 0 : _a.path)) {
                this.logger.warn(`No webhook node found in workflow: ${workflowId}`);
                return null;
            }
            let webhookPath = String(webhookNode.parameters.path);
            webhookPath = webhookPath.replace(/^\/+/, '');
            const baseUrl = this.resolveBaseUrl();
            const webhookUrl = `${baseUrl}/webhook/${webhookPath}`;
            await this.prisma.n8nWorkflow.update({
                where: { id: workflow.n8nWorkflow.id },
                data: {
                    webhookUrl,
                    lastValidatedAt: new Date(),
                },
            });
            await this.cacheService.invalidate(workflowId);
            const isVoiceWorkflow = await this.isVoiceWorkflow(workflowId);
            await this.cacheService.setWebhookUrl(workflowId, webhookUrl, isVoiceWorkflow);
            const duration = Date.now() - startTime;
            this.logger.log(`Webhook URL refreshed for workflow ${workflowId} in ${duration}ms: ${webhookUrl}`);
            if (duration > this.REFRESH_TIMEOUT_MS) {
                this.logger.warn(`Webhook refresh exceeded voice timeout threshold (${duration}ms > ${this.REFRESH_TIMEOUT_MS}ms)`);
            }
            this.cacheService.resetCircuitBreaker(workflowId);
            return webhookUrl;
        }
        catch (error) {
            const duration = Date.now() - startTime;
            this.logger.error(`Failed to refresh webhook URL for workflow ${workflowId} after ${duration}ms: ${error.message}`, error.stack);
            return null;
        }
    }
    resolveBaseUrl() {
        const webhookUrl = this.configService.get('N8N_WEBHOOK_URL');
        if (webhookUrl) {
            return this.cleanUrl(webhookUrl);
        }
        const publicUrl = this.configService.get('N8N_PUBLIC_URL');
        if (publicUrl) {
            return this.cleanUrl(publicUrl);
        }
        const apiUrl = this.configService.get('N8N_API_URL');
        if (apiUrl) {
            const cleaned = apiUrl.replace(/\/?api(?:\/v\d+)?$/, '');
            return this.cleanUrl(cleaned);
        }
        this.logger.warn('No n8n base URL configured in environment variables');
        return '';
    }
    cleanUrl(url) {
        let cleaned = url.replace(/\/$/, '');
        if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
            cleaned = `https://${cleaned}`;
        }
        return cleaned;
    }
    async batchRefreshWebhookUrls(workflowIds) {
        const results = new Map();
        this.logger.log(`Starting batch refresh for ${workflowIds.length} workflows`);
        const promises = workflowIds.map(async (workflowId) => {
            const url = await this.refreshWebhookUrl(workflowId);
            results.set(workflowId, url);
        });
        await Promise.allSettled(promises);
        const successCount = Array.from(results.values()).filter(url => url !== null).length;
        this.logger.log(`Batch refresh completed: ${successCount}/${workflowIds.length} successful`);
        return results;
    }
    async getWebhookUrl(workflowId, isVoiceWorkflow = false) {
        var _a;
        const startTime = Date.now();
        try {
            const cachedUrl = await this.cacheService.getWebhookUrl(workflowId, isVoiceWorkflow);
            if (cachedUrl) {
                const duration = Date.now() - startTime;
                if (isVoiceWorkflow && duration > 10) {
                    this.logger.warn(`Voice workflow cache hit exceeded latency threshold: ${duration}ms (target < 10ms)`);
                }
                return cachedUrl;
            }
            const workflow = await this.prisma.workflow.findUnique({
                where: { id: workflowId },
                include: { n8nWorkflow: true },
            });
            const webhookUrl = ((_a = workflow === null || workflow === void 0 ? void 0 : workflow.n8nWorkflow) === null || _a === void 0 ? void 0 : _a.webhookUrl) || null;
            if (webhookUrl) {
                await this.cacheService.setWebhookUrl(workflowId, webhookUrl, isVoiceWorkflow);
            }
            const duration = Date.now() - startTime;
            this.logger.log(`Webhook URL retrieved from database for ${workflowId} in ${duration}ms`);
            if (isVoiceWorkflow && duration > 300) {
                this.logger.warn(`Voice workflow database query exceeded latency threshold: ${duration}ms (target < 300ms)`);
            }
            return webhookUrl;
        }
        catch (error) {
            this.logger.error(`Failed to get webhook URL for workflow ${workflowId}: ${error.message}`);
            return null;
        }
    }
    async getWebhookUrlDirect(workflowId) {
        var _a;
        try {
            const workflow = await this.prisma.workflow.findUnique({
                where: { id: workflowId },
                include: { n8nWorkflow: true },
            });
            return ((_a = workflow === null || workflow === void 0 ? void 0 : workflow.n8nWorkflow) === null || _a === void 0 ? void 0 : _a.webhookUrl) || null;
        }
        catch (error) {
            this.logger.error(`Failed to get webhook URL directly for workflow ${workflowId}: ${error.message}`);
            return null;
        }
    }
    async isVoiceWorkflow(workflowId) {
        var _a, _b;
        try {
            const workflow = await this.prisma.workflow.findUnique({
                where: { id: workflowId },
                include: {
                    agent: {
                        select: {
                            ttsProvider: true,
                            sttProvider: true,
                        }
                    }
                },
            });
            return !!(((_a = workflow === null || workflow === void 0 ? void 0 : workflow.agent) === null || _a === void 0 ? void 0 : _a.ttsProvider) || ((_b = workflow === null || workflow === void 0 ? void 0 : workflow.agent) === null || _b === void 0 ? void 0 : _b.sttProvider));
        }
        catch (error) {
            this.logger.error(`Failed to check if workflow ${workflowId} is voice-enabled: ${error.message}`);
            return false;
        }
    }
    async needsRefresh(workflowId, maxAgeMinutes = 60) {
        try {
            const workflow = await this.prisma.workflow.findUnique({
                where: { id: workflowId },
                include: { n8nWorkflow: true },
            });
            if (!(workflow === null || workflow === void 0 ? void 0 : workflow.n8nWorkflow)) {
                return true;
            }
            if (!workflow.n8nWorkflow.webhookUrl) {
                return true;
            }
            const lastValidated = workflow.n8nWorkflow.lastValidatedAt;
            if (!lastValidated) {
                return true;
            }
            const ageMinutes = (Date.now() - lastValidated.getTime()) / (1000 * 60);
            return ageMinutes > maxAgeMinutes;
        }
        catch (error) {
            this.logger.error(`Failed to check refresh status for workflow ${workflowId}: ${error.message}`);
            return true;
        }
    }
};
exports.WebhookUrlService = WebhookUrlService;
exports.WebhookUrlService = WebhookUrlService = WebhookUrlService_1 = tslib_1.__decorate([
    (0, common_1.Injectable)(),
    tslib_1.__metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService,
        cache_utils_1.WebhookCacheService])
], WebhookUrlService);
//# sourceMappingURL=webhook-url.service.js.map