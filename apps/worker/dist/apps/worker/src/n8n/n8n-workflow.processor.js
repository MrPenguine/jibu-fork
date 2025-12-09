"use strict";
var N8nWorkflowProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.N8nWorkflowProcessor = void 0;
const tslib_1 = require("tslib");
const bull_1 = require("@nestjs/bull");
const common_1 = require("@nestjs/common");
const queue_definitions_1 = require("@jibu/queue-definitions");
const n8n_integration_service_1 = require("./n8n-integration.service");
const n8n_worker_config_1 = require("./n8n-worker.config");
const axios_1 = require("@nestjs/axios");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
let N8nWorkflowProcessor = N8nWorkflowProcessor_1 = class N8nWorkflowProcessor {
    constructor(n8nIntegrationService, n8nWorkerConfig, httpService) {
        this.n8nIntegrationService = n8nIntegrationService;
        this.n8nWorkerConfig = n8nWorkerConfig;
        this.httpService = httpService;
        this.logger = new common_1.Logger(N8nWorkflowProcessor_1.name);
    }
    async handleExecuteWorkflow(job) {
        this.logger.log(`Processing workflow execution job ${job.id} for workflow ${job.data.workflowId}`);
        try {
            const startTime = Date.now();
            const executionResult = await this.n8nIntegrationService.executeWorkflow(job.data.workflowId, {
                workflowData: {
                    organizationId: job.data.organizationId,
                    userId: job.data.userId,
                    input: job.data.input || {},
                    jobId: job.id.toString(),
                }
            });
            const executionTime = (Date.now() - startTime) / 1000;
            this.logger.log(`Workflow ${job.data.workflowId} executed in ${executionTime}s with execution ID: ${executionResult.executionId}`);
            if (job.data.callbackUrl) {
                await this.sendExecutionCallback(job.data.callbackUrl, {
                    status: 'completed',
                    executionId: executionResult.executionId,
                    workflowId: job.data.workflowId,
                    organizationId: job.data.organizationId,
                    jobId: job.id.toString(),
                    executionTime,
                    result: executionResult,
                });
            }
            return {
                executionId: executionResult.executionId,
                status: 'completed',
                executionTime,
            };
        }
        catch (error) {
            this.logger.error(`Error executing workflow ${job.data.workflowId}: ${error.message}`, error.stack);
            if (job.data.callbackUrl) {
                await this.sendExecutionCallback(job.data.callbackUrl, {
                    status: 'failed',
                    error: error.message,
                    workflowId: job.data.workflowId,
                    organizationId: job.data.organizationId,
                    jobId: job.id.toString(),
                });
            }
            throw error;
        }
    }
    async handleCheckWorkflowStatus(job) {
        this.logger.log(`Checking status for workflow execution ${job.data.executionId}`);
        try {
            const status = await this.n8nIntegrationService.getExecutionStatus(job.data.executionId);
            return {
                executionId: job.data.executionId,
                status: status.status,
                data: status,
            };
        }
        catch (error) {
            this.logger.error(`Error checking workflow status for execution ${job.data.executionId}: ${error.message}`, error.stack);
            throw error;
        }
    }
    async handleCancelWorkflow(job) {
        this.logger.log(`Cancelling workflow execution ${job.data.executionId}`);
        try {
            await this.n8nIntegrationService.stopExecution(job.data.executionId);
            return {
                executionId: job.data.executionId,
                status: 'cancelled',
                reason: job.data.reason || 'Cancelled by user',
            };
        }
        catch (error) {
            this.logger.error(`Error cancelling workflow execution ${job.data.executionId}: ${error.message}`, error.stack);
            throw error;
        }
    }
    async sendExecutionCallback(callbackUrl, data) {
        try {
            await (0, rxjs_1.firstValueFrom)(this.httpService
                .post(callbackUrl, data)
                .pipe((0, operators_1.catchError)((error) => {
                this.logger.error(`Failed to send execution callback to ${callbackUrl}: ${error.message}`, error.stack);
                throw error;
            })));
            this.logger.log(`Execution callback sent to ${callbackUrl}`);
        }
        catch (error) {
            this.logger.error(`Error sending execution callback: ${error.message}`);
        }
    }
};
exports.N8nWorkflowProcessor = N8nWorkflowProcessor;
tslib_1.__decorate([
    (0, bull_1.Process)(queue_definitions_1.JOB_NAMES.EXECUTE_WORKFLOW),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [Object]),
    tslib_1.__metadata("design:returntype", Promise)
], N8nWorkflowProcessor.prototype, "handleExecuteWorkflow", null);
tslib_1.__decorate([
    (0, bull_1.Process)(queue_definitions_1.JOB_NAMES.CHECK_WORKFLOW_STATUS),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [Object]),
    tslib_1.__metadata("design:returntype", Promise)
], N8nWorkflowProcessor.prototype, "handleCheckWorkflowStatus", null);
tslib_1.__decorate([
    (0, bull_1.Process)(queue_definitions_1.JOB_NAMES.CANCEL_WORKFLOW),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [Object]),
    tslib_1.__metadata("design:returntype", Promise)
], N8nWorkflowProcessor.prototype, "handleCancelWorkflow", null);
exports.N8nWorkflowProcessor = N8nWorkflowProcessor = N8nWorkflowProcessor_1 = tslib_1.__decorate([
    (0, common_1.Injectable)(),
    (0, bull_1.Processor)(queue_definitions_1.QUEUE_NAMES.WORKFLOW_EXECUTION),
    tslib_1.__metadata("design:paramtypes", [n8n_integration_service_1.N8nIntegrationService,
        n8n_worker_config_1.N8nWorkerConfig,
        axios_1.HttpService])
], N8nWorkflowProcessor);
//# sourceMappingURL=n8n-workflow.processor.js.map