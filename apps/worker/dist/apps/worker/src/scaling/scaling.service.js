"use strict";
var ScalingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScalingService = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const schedule_1 = require("@nestjs/schedule");
const bull_1 = require("@nestjs/bull");
const queue_definitions_1 = require("@jibu/queue-definitions");
const n8n_worker_config_1 = require("../n8n/n8n-worker.config");
let ScalingService = ScalingService_1 = class ScalingService {
    constructor(configService, n8nWorkerConfig, workflowQueue, webhookQueue) {
        this.configService = configService;
        this.n8nWorkerConfig = n8nWorkerConfig;
        this.workflowQueue = workflowQueue;
        this.webhookQueue = webhookQueue;
        this.logger = new common_1.Logger(ScalingService_1.name);
        this.minWorkers = this.n8nWorkerConfig.getMinWorkers();
        this.maxWorkers = this.n8nWorkerConfig.getMaxWorkers();
        this.queueThreshold = this.n8nWorkerConfig.getQueueThreshold();
        this.currentWorkers = this.minWorkers;
        this.scalingEnabled = this.configService.get('ENABLE_WORKER_SCALING', 'false') === 'true';
        this.logger.log(`Scaling service initialized with min=${this.minWorkers}, max=${this.maxWorkers}, threshold=${this.queueThreshold}`);
        this.logger.log(`Worker scaling is ${this.scalingEnabled ? 'enabled' : 'disabled'}`);
    }
    onModuleInit() {
        this.currentWorkers = this.minWorkers;
        this.logger.log(`Starting with ${this.currentWorkers} workers`);
    }
    async monitorQueue() {
        if (!this.scalingEnabled) {
            return;
        }
        try {
            const workflowMetrics = await this.getWorkflowQueueMetrics();
            const webhookMetrics = await this.getWebhookQueueMetrics();
            const totalWaiting = workflowMetrics.waiting + webhookMetrics.waiting;
            const totalActive = workflowMetrics.active + webhookMetrics.active;
            const totalLength = workflowMetrics.length + webhookMetrics.length;
            this.logger.debug(`Queue metrics: ` +
                `workflow(length=${workflowMetrics.length}, active=${workflowMetrics.active}, waiting=${workflowMetrics.waiting}), ` +
                `webhook(length=${webhookMetrics.length}, active=${webhookMetrics.active}, waiting=${webhookMetrics.waiting}), ` +
                `workers=${this.currentWorkers}`);
            if ((webhookMetrics.waiting > 50 || totalWaiting > this.queueThreshold) && this.currentWorkers < this.maxWorkers) {
                await this.scaleUp();
            }
            else if (webhookMetrics.waiting < 20 && totalWaiting < this.queueThreshold / 2 && totalActive < this.currentWorkers / 2 && this.currentWorkers > this.minWorkers) {
                await this.scaleDown();
            }
        }
        catch (error) {
            this.logger.error(`Error monitoring queue: ${error.message}`, error.stack);
        }
    }
    async getWorkflowQueueMetrics() {
        const counts = await this.workflowQueue.getJobCounts();
        return {
            length: counts.waiting + counts.active + counts.delayed,
            active: counts.active,
            waiting: counts.waiting,
        };
    }
    async getWebhookQueueMetrics() {
        const counts = await this.webhookQueue.getJobCounts();
        return {
            length: counts.waiting + counts.active + counts.delayed,
            active: counts.active,
            waiting: counts.waiting,
        };
    }
    async getQueueLength() {
        const workflowMetrics = await this.getWorkflowQueueMetrics();
        const webhookMetrics = await this.getWebhookQueueMetrics();
        return workflowMetrics.length + webhookMetrics.length;
    }
    async getActiveJobCount() {
        const workflowMetrics = await this.getWorkflowQueueMetrics();
        const webhookMetrics = await this.getWebhookQueueMetrics();
        return workflowMetrics.active + webhookMetrics.active;
    }
    async getWaitingJobCount() {
        const workflowMetrics = await this.getWorkflowQueueMetrics();
        const webhookMetrics = await this.getWebhookQueueMetrics();
        return workflowMetrics.waiting + webhookMetrics.waiting;
    }
    async scaleUp() {
        const previousWorkers = this.currentWorkers;
        const newWorkers = Math.min(Math.ceil(this.currentWorkers * 1.5), this.maxWorkers);
        if (newWorkers > previousWorkers) {
            this.currentWorkers = newWorkers;
            this.logger.log(`Scaling up workers from ${previousWorkers} to ${this.currentWorkers}`);
            await this.applyScaling();
        }
    }
    async scaleDown() {
        const previousWorkers = this.currentWorkers;
        const newWorkers = Math.max(Math.floor(this.currentWorkers * 0.75), this.minWorkers);
        if (newWorkers < previousWorkers) {
            this.currentWorkers = newWorkers;
            this.logger.log(`Scaling down workers from ${previousWorkers} to ${this.currentWorkers}`);
            await this.applyScaling();
        }
    }
    async applyScaling() {
        this.logger.log(`Applied scaling: ${this.currentWorkers} workers`);
    }
};
exports.ScalingService = ScalingService;
tslib_1.__decorate([
    (0, schedule_1.Interval)(30000),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", []),
    tslib_1.__metadata("design:returntype", Promise)
], ScalingService.prototype, "monitorQueue", null);
exports.ScalingService = ScalingService = ScalingService_1 = tslib_1.__decorate([
    (0, common_1.Injectable)(),
    tslib_1.__param(2, (0, bull_1.InjectQueue)(queue_definitions_1.QUEUE_NAMES.WORKFLOW_EXECUTION)),
    tslib_1.__param(3, (0, bull_1.InjectQueue)(queue_definitions_1.QUEUE_NAMES.WEBHOOK_DELIVERY)),
    tslib_1.__metadata("design:paramtypes", [config_1.ConfigService,
        n8n_worker_config_1.N8nWorkerConfig, Object, Object])
], ScalingService);
//# sourceMappingURL=scaling.service.js.map