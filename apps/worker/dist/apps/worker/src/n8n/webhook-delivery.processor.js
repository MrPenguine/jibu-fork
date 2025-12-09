"use strict";
var WebhookDeliveryProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookDeliveryProcessor = void 0;
const tslib_1 = require("tslib");
const bull_1 = require("@nestjs/bull");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const queue_definitions_1 = require("@jibu/queue-definitions");
const cache_utils_1 = require("@jibu/cache-utils");
const axios_1 = require("axios");
const webhook_url_service_1 = require("../../../backend/src/core/webhook/webhook-url.service");
let WebhookDeliveryProcessor = WebhookDeliveryProcessor_1 = class WebhookDeliveryProcessor {
    constructor(webhookCacheService, configService, webhookUrlService) {
        this.webhookCacheService = webhookCacheService;
        this.configService = configService;
        this.webhookUrlService = webhookUrlService;
        this.logger = new common_1.Logger(WebhookDeliveryProcessor_1.name);
        this.WEBHOOK_TIMEOUT_MS = 5000;
        this.FALLBACK_MESSAGE = 'I apologize, but I\'m experiencing technical difficulties. Please try again.';
        this.failureCount = new Map();
        this.circuitBreakerThreshold = 3;
        this.circuitBreakerResetTime = 5 * 60 * 1000;
        this.deliveryCount = 0;
        this.failureCountTotal = 0;
        this.fallbackCount = 0;
        this.totalDeliveryTime = 0;
    }
    onModuleInit() {
        this.logger.log(`WebhookDeliveryProcessor initialized for queue: ${queue_definitions_1.QUEUE_NAMES.WEBHOOK_DELIVERY}`);
        this.logger.log(`Listening for job: ${queue_definitions_1.JOB_NAMES.DELIVER_WEBHOOK}`);
        setInterval(() => {
            this.logMetrics();
        }, 5 * 60 * 1000);
    }
    onActive(job) {
        const payload = job.data;
        const { workflowId, sessionId } = payload;
        const isVoice = payload.eventType === 'call' || payload.isVoice === true;
        this.logger.debug(`Job ${job.id} active - Delivering ${isVoice ? 'voice' : 'non-voice'} webhook for workflow ${workflowId}, session ${sessionId}`);
    }
    onCompleted(job, result) {
        const payload = job.data;
        const { workflowId } = payload;
        const isVoice = payload.eventType === 'call' || payload.isVoice === true;
        this.logger.log(`Job ${job.id} completed - ${isVoice ? 'Voice' : 'Non-voice'} webhook delivered for workflow ${workflowId}`);
    }
    onFailed(job, err) {
        const payload = job.data;
        const { workflowId, sessionId } = payload;
        const isVoice = payload.eventType === 'call' || payload.isVoice === true;
        this.logger.error(`Job ${job.id} failed - ${isVoice ? 'Voice' : 'Non-voice'} webhook delivery failed for workflow ${workflowId}, session ${sessionId}: ${err.message}`, err.stack);
        this.failureCountTotal++;
    }
    async handle(job) {
        var _a, _b, _c, _d, _e, _f, _g;
        const startTime = Date.now();
        const payload = job.data;
        const { workflowId, sessionId } = payload;
        const isVoice = payload.eventType === 'call' || payload.isVoice === true;
        const priority = job.opts.priority;
        try {
            if (!sessionId || !workflowId) {
                throw new Error('Invalid webhook payload: missing sessionId or workflowId');
            }
            this.logger.log(`Processing webhook delivery job ${job.id} for workflow ${workflowId}, session ${sessionId}, ` +
                `eventType: ${payload.eventType}, isVoice: ${isVoice}, priority: ${priority}`);
            if (isVoice && payload.eventType === 'message' && payload.voiceMetadata) {
                this.logger.debug(`Voice metadata - confidence: ${payload.voiceMetadata.confidence.toFixed(2)}, ` +
                    `language: ${payload.voiceMetadata.language}, duration: ${payload.voiceMetadata.duration}ms`);
            }
            if (payload.eventType === 'call' && payload.callEvent) {
                this.logger.debug(`Call event - type: ${payload.callEvent.type}, from: ${payload.callEvent.from || 'N/A'}, ` +
                    `to: ${payload.callEvent.to || 'N/A'}`);
            }
            if (this.shouldTriggerCircuitBreaker(workflowId)) {
                this.logger.error(`Circuit breaker open for workflow ${workflowId}, triggering fallback`);
                if (isVoice) {
                    this.fallbackCount++;
                    return { fallback: true, message: this.FALLBACK_MESSAGE };
                }
                throw new Error(`Circuit breaker open for workflow ${workflowId}`);
            }
            const rawWebhookUrl = await this.getWebhookUrl(workflowId, isVoice);
            if (!rawWebhookUrl) {
                this.logger.error(`No webhook URL found for workflow ${workflowId}`);
                if (isVoice) {
                    this.fallbackCount++;
                    return { fallback: true, message: this.FALLBACK_MESSAGE };
                }
                throw new Error(`No webhook URL found for workflow ${workflowId}`);
            }
            const webhookUrl = this.normalizeWebhookUrl(rawWebhookUrl);
            const payloadSummary = {
                eventType: payload.eventType,
                hasText: !!payload.text,
                hasVoiceMetadata: !!payload.voiceMetadata,
                hasCallEvent: !!payload.callEvent,
                hasAiContext: !!payload.aiContext,
                conversationHistoryLength: (_c = (_b = (_a = payload.aiContext) === null || _a === void 0 ? void 0 : _a.conversationHistory) === null || _b === void 0 ? void 0 : _b.length) !== null && _c !== void 0 ? _c : 0,
                ragResultsLength: (_g = (_f = (_e = (_d = payload.aiContext) === null || _d === void 0 ? void 0 : _d.ragContext) === null || _e === void 0 ? void 0 : _e.results) === null || _f === void 0 ? void 0 : _f.length) !== null && _g !== void 0 ? _g : 0,
            };
            this.logger.log(`Resolved webhook URL for workflow ${workflowId}: ${webhookUrl} | ` +
                `Payload summary: ${JSON.stringify(payloadSummary)}`);
            this.logger.debug(`Delivering ${payload.eventType} for session ${sessionId} (workflow ${workflowId})`);
            const deliveryStartTime = Date.now();
            const response = await this.deliverWebhook(webhookUrl, payload, isVoice);
            const deliveryDuration = Date.now() - deliveryStartTime;
            if (payload.aiContext) {
                this.logger.debug(`AI context included - systemPrompt: ${payload.aiContext.systemPrompt ? 'yes' : 'no'}, ` +
                    `conversationHistory: ${payload.aiContext.conversationHistory.length} messages, ` +
                    `ragContext: ${payload.aiContext.ragContext.results.length} results`);
            }
            this.deliveryCount++;
            this.totalDeliveryTime += deliveryDuration;
            this.resetCircuitBreaker(workflowId);
            const totalDuration = Date.now() - startTime;
            this.logger.log(`Webhook delivered successfully for workflow ${workflowId} in ${deliveryDuration}ms (total: ${totalDuration}ms)`);
            if (isVoice && deliveryDuration > 500) {
                this.logger.warn(`Voice webhook delivery exceeded target latency: ${deliveryDuration}ms (target < 500ms)`);
            }
            return {
                success: true,
                deliveryTime: deliveryDuration,
                totalTime: totalDuration,
                response: response.data,
            };
        }
        catch (error) {
            const err = error;
            const duration = Date.now() - startTime;
            this.logger.error(`Webhook delivery failed for workflow ${workflowId} after ${duration}ms: ${err.message}`, err.stack);
            this.incrementFailureCount(workflowId);
            if (isVoice && job.attemptsMade >= 2) {
                this.logger.warn(`Max retries reached for voice workflow ${workflowId}, triggering fallback`);
                this.fallbackCount++;
                return { fallback: true, message: this.FALLBACK_MESSAGE };
            }
            throw error;
        }
    }
    async getWebhookUrl(workflowId, isVoice) {
        try {
            const cachedUrl = await this.webhookCacheService.getWebhookUrl(workflowId, isVoice);
            if (cachedUrl) {
                return cachedUrl;
            }
            this.logger.warn(`Cache miss for ${isVoice ? 'voice' : 'non-voice'} workflow ${workflowId}`);
            const dbUrl = await this.webhookUrlService.getWebhookUrl(workflowId, isVoice);
            if (dbUrl) {
                this.logger.log(`Webhook URL resolved from database for ${isVoice ? 'voice' : 'non-voice'} workflow ${workflowId}`);
                return dbUrl;
            }
            this.logger.error(`Webhook URL not found in database for workflow ${workflowId}`);
            return null;
        }
        catch (error) {
            const err = error;
            this.logger.error(`Error retrieving webhook URL for workflow ${workflowId}: ${err.message}`);
            return null;
        }
    }
    async deliverWebhook(webhookUrl, payload, isVoice) {
        try {
            const timeout = isVoice ? this.WEBHOOK_TIMEOUT_MS : 10000;
            const response = await axios_1.default.post(webhookUrl, payload, {
                timeout,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Jibu-Webhook-Delivery/1.0',
                    'X-Jibu-Voice': isVoice ? 'true' : 'false',
                    'X-Jibu-Event-Type': payload.eventType,
                    'X-Jibu-Session-Id': payload.sessionId,
                },
                validateStatus: (status) => status >= 200 && status < 300,
            });
            return response;
        }
        catch (error) {
            const axiosError = error;
            if (axiosError.response && axiosError.response.status === 404) {
                const workflowId = payload.workflowId;
                if (workflowId) {
                    try {
                        await this.webhookCacheService.refreshAndInvalidate(workflowId);
                        await this.webhookUrlService.refreshWebhookUrl(workflowId);
                        this.logger.warn(`Detected stale webhook URL (404) — refreshed from n8n (workflow ${workflowId})`);
                    }
                    catch (refreshError) {
                        const refreshErr = refreshError;
                        this.logger.error(`Failed to refresh webhook URL after 404 for workflow ${workflowId}: ${refreshErr.message}`, refreshErr.stack);
                    }
                }
                else {
                    this.logger.warn('Detected stale webhook URL (404) but payload.workflowId is missing; unable to refresh');
                }
            }
            if (axiosError.code === 'ECONNABORTED') {
                throw new Error(`Webhook delivery timeout after ${this.WEBHOOK_TIMEOUT_MS}ms`);
            }
            if (axiosError.response) {
                throw new Error(`Webhook returned error status ${axiosError.response.status}: ${axiosError.response.statusText}`);
            }
            if (axiosError.request) {
                throw new Error(`No response received from webhook: ${axiosError.message}`);
            }
            throw new Error(`Webhook delivery error: ${axiosError.message}`);
        }
    }
    normalizeWebhookUrl(url) {
        try {
            const parsed = new URL(url);
            parsed.pathname = parsed.pathname.replace(/\/+/, '/').replace(/\/{2,}/g, '/');
            return parsed.toString();
        }
        catch (_a) {
            return url.replace(/([^:])\/{2,}/g, '$1/');
        }
    }
    shouldTriggerCircuitBreaker(workflowId) {
        const failures = this.failureCount.get(workflowId) || 0;
        return failures >= this.circuitBreakerThreshold;
    }
    incrementFailureCount(workflowId) {
        const current = this.failureCount.get(workflowId) || 0;
        this.failureCount.set(workflowId, current + 1);
        setTimeout(() => {
            this.failureCount.delete(workflowId);
        }, this.circuitBreakerResetTime);
    }
    resetCircuitBreaker(workflowId) {
        this.failureCount.delete(workflowId);
    }
    logMetrics() {
        const avgDeliveryTime = this.deliveryCount > 0
            ? (this.totalDeliveryTime / this.deliveryCount).toFixed(2)
            : 0;
        const fallbackRate = this.deliveryCount > 0
            ? ((this.fallbackCount / this.deliveryCount) * 100).toFixed(2)
            : 0;
        this.logger.log(`Webhook Delivery Metrics: ` +
            `Total: ${this.deliveryCount}, ` +
            `Failures: ${this.failureCountTotal}, ` +
            `Fallbacks: ${this.fallbackCount} (${fallbackRate}%), ` +
            `Avg Delivery Time: ${avgDeliveryTime}ms`);
    }
};
exports.WebhookDeliveryProcessor = WebhookDeliveryProcessor;
tslib_1.__decorate([
    (0, bull_1.OnQueueActive)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [Object]),
    tslib_1.__metadata("design:returntype", void 0)
], WebhookDeliveryProcessor.prototype, "onActive", null);
tslib_1.__decorate([
    (0, bull_1.OnQueueCompleted)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [Object, Object]),
    tslib_1.__metadata("design:returntype", void 0)
], WebhookDeliveryProcessor.prototype, "onCompleted", null);
tslib_1.__decorate([
    (0, bull_1.OnQueueFailed)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [Object, Error]),
    tslib_1.__metadata("design:returntype", void 0)
], WebhookDeliveryProcessor.prototype, "onFailed", null);
tslib_1.__decorate([
    (0, bull_1.Process)(queue_definitions_1.JOB_NAMES.DELIVER_WEBHOOK),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [Object]),
    tslib_1.__metadata("design:returntype", Promise)
], WebhookDeliveryProcessor.prototype, "handle", null);
exports.WebhookDeliveryProcessor = WebhookDeliveryProcessor = WebhookDeliveryProcessor_1 = tslib_1.__decorate([
    (0, common_1.Injectable)(),
    (0, bull_1.Processor)(queue_definitions_1.QUEUE_NAMES.WEBHOOK_DELIVERY),
    tslib_1.__metadata("design:paramtypes", [cache_utils_1.WebhookCacheService,
        config_1.ConfigService,
        webhook_url_service_1.WebhookUrlService])
], WebhookDeliveryProcessor);
//# sourceMappingURL=webhook-delivery.processor.js.map