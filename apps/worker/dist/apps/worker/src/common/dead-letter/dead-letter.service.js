"use strict";
var DeadLetterService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeadLetterService = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const bull_1 = require("@nestjs/bull");
const queue_definitions_1 = require("@jibu/queue-definitions");
let DeadLetterService = DeadLetterService_1 = class DeadLetterService {
    constructor(configService, workflowQueue) {
        this.configService = configService;
        this.workflowQueue = workflowQueue;
        this.logger = new common_1.Logger(DeadLetterService_1.name);
        this.deadLetterQueueName = 'dead-letter-queue';
        this.maxRetries = parseInt(this.configService.get('MAX_JOB_RETRIES', '3'), 10);
        this.logger.log(`Dead letter service initialized with maxRetries=${this.maxRetries}`);
    }
    async processFailedJob(queueName, jobId, error, jobData) {
        try {
            const job = await this.workflowQueue.getJob(jobId);
            if (!job) {
                this.logger.warn(`Job ${jobId} not found in queue ${queueName}`);
                return;
            }
            if (job.attemptsMade >= this.maxRetries) {
                this.logger.warn(`Job ${jobId} in queue ${queueName} has failed ${job.attemptsMade} times, moving to dead letter queue`);
                await this.addToDeadLetterQueue(queueName, jobId, error, jobData);
                await job.remove();
                this.logger.log(`Job ${jobId} moved to dead letter queue and removed from ${queueName}`);
            }
            else {
                this.logger.log(`Job ${jobId} in queue ${queueName} has failed ${job.attemptsMade} times, will be retried`);
            }
        }
        catch (dlqError) {
            this.logger.error(`Error processing failed job ${jobId}: ${dlqError.message}`, dlqError.stack);
        }
    }
    async addToDeadLetterQueue(originalQueue, originalJobId, error, jobData) {
        const deadLetterData = {
            originalQueue,
            originalJobId,
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name,
            },
            jobData,
            failedAt: new Date().toISOString(),
        };
        const jobOptions = {
            attempts: 1,
            removeOnComplete: false,
            removeOnFail: false,
        };
        this.logDeadLetterJob(deadLetterData);
    }
    logDeadLetterJob(deadLetterData) {
        this.logger.error(`DEAD LETTER JOB: ${JSON.stringify(deadLetterData, null, 2)}`);
    }
    async retryDeadLetterJob(deadLetterJobId) {
        try {
            this.logger.log(`Would retry dead letter job ${deadLetterJobId}`);
            return true;
        }
        catch (error) {
            this.logger.error(`Error retrying dead letter job ${deadLetterJobId}: ${error.message}`, error.stack);
            return false;
        }
    }
};
exports.DeadLetterService = DeadLetterService;
exports.DeadLetterService = DeadLetterService = DeadLetterService_1 = tslib_1.__decorate([
    (0, common_1.Injectable)(),
    tslib_1.__param(1, (0, bull_1.InjectQueue)(queue_definitions_1.QUEUE_NAMES.WORKFLOW_EXECUTION)),
    tslib_1.__metadata("design:paramtypes", [config_1.ConfigService, Object])
], DeadLetterService);
//# sourceMappingURL=dead-letter.service.js.map