"use strict";
var QueueProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueProcessor = void 0;
const tslib_1 = require("tslib");
const bull_1 = require("@nestjs/bull");
const common_1 = require("@nestjs/common");
const queue_definitions_1 = require("@jibu/queue-definitions");
let QueueProcessor = QueueProcessor_1 = class QueueProcessor {
    constructor() {
        this.logger = new common_1.Logger(QueueProcessor_1.name);
    }
    async processDefaultJob(job) {
        this.logger.debug(`Processing job ${job.id} of type ${job.name} with data: ${JSON.stringify(job.data)}`);
        try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            this.logger.debug(`Job ${job.id} completed successfully`);
            return { success: true, jobId: job.id };
        }
        catch (error) {
            this.logger.error(`Error processing job ${job.id}: ${error.message}`, error.stack);
            throw error;
        }
    }
    async processEmailJob(job) {
        this.logger.debug(`Processing email job ${job.id} for recipient: ${job.data.recipient}`);
        try {
            await new Promise(resolve => setTimeout(resolve, 500));
            this.logger.debug(`Email job ${job.id} completed successfully. Email sent to ${job.data.recipient}`);
            return { success: true, jobId: job.id, recipient: job.data.recipient };
        }
        catch (error) {
            this.logger.error(`Error processing email job ${job.id}: ${error.message}`, error.stack);
            throw error;
        }
    }
};
exports.QueueProcessor = QueueProcessor;
tslib_1.__decorate([
    (0, bull_1.Process)(queue_definitions_1.JOB_NAMES.DEFAULT_JOB),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [Object]),
    tslib_1.__metadata("design:returntype", Promise)
], QueueProcessor.prototype, "processDefaultJob", null);
tslib_1.__decorate([
    (0, bull_1.Process)(queue_definitions_1.JOB_NAMES.EMAIL_JOB),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [Object]),
    tslib_1.__metadata("design:returntype", Promise)
], QueueProcessor.prototype, "processEmailJob", null);
exports.QueueProcessor = QueueProcessor = QueueProcessor_1 = tslib_1.__decorate([
    (0, bull_1.Processor)(queue_definitions_1.QUEUE_NAMES.DEFAULT)
], QueueProcessor);
//# sourceMappingURL=queue.processor.js.map