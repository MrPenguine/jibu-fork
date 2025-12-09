"use strict";
var N8nIntegrationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.N8nIntegrationService = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = require("@nestjs/axios");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
let N8nIntegrationService = N8nIntegrationService_1 = class N8nIntegrationService {
    constructor(configService, httpService) {
        this.configService = configService;
        this.httpService = httpService;
        this.logger = new common_1.Logger(N8nIntegrationService_1.name);
        const raw = (this.configService.get('N8N_API_URL') || '').replace(/\/$/, '');
        this.apiUrl = /\/api(\/v\d+)?$/.test(raw) ? (/\/api$/.test(raw) ? `${raw}/v1` : raw) : `${raw}/api/v1`;
        this.apiKey = this.configService.get('N8N_API_KEY');
        if (!raw) {
            this.logger.error('N8N_API_URL not found in environment variables');
            throw new Error('N8N_API_URL is required for n8n integration');
        }
        if (!this.apiKey) {
            this.logger.error('N8N_API_KEY not found in environment variables');
            throw new Error('N8N_API_KEY is required for n8n integration');
        }
        this.logger.log(`Resolved n8n API base: ${this.apiUrl}`);
    }
    async executeWorkflow(workflowId, data) {
        try {
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService
                .post(`${this.apiUrl}/workflows/${workflowId}/execute`, data, {
                headers: {
                    'X-N8N-API-KEY': this.apiKey,
                    'Content-Type': 'application/json',
                },
            })
                .pipe((0, operators_1.map)((response) => response.data), (0, operators_1.catchError)((error) => {
                this.logger.error(`Failed to execute workflow ${workflowId}: ${error.message}`, error.stack);
                throw new Error(`Failed to execute workflow: ${error.message}`);
            })));
            this.logger.log(`Workflow ${workflowId} executed successfully`);
            return response;
        }
        catch (error) {
            this.logger.error(`Error executing workflow ${workflowId}: ${error.message}`, error.stack);
            throw error;
        }
    }
    async getExecutionStatus(executionId) {
        try {
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService
                .get(`${this.apiUrl}/executions/${executionId}`, {
                headers: {
                    'X-N8N-API-KEY': this.apiKey,
                },
            })
                .pipe((0, operators_1.map)((response) => response.data), (0, operators_1.catchError)((error) => {
                this.logger.error(`Failed to get execution status for ${executionId}: ${error.message}`, error.stack);
                throw new Error(`Failed to get execution status: ${error.message}`);
            })));
            return response;
        }
        catch (error) {
            this.logger.error(`Error getting execution status for ${executionId}: ${error.message}`, error.stack);
            throw error;
        }
    }
    async stopExecution(executionId) {
        try {
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService
                .post(`${this.apiUrl}/executions/${executionId}/stop`, {}, {
                headers: {
                    'X-N8N-API-KEY': this.apiKey,
                    'Content-Type': 'application/json',
                },
            })
                .pipe((0, operators_1.map)((response) => response.data), (0, operators_1.catchError)((error) => {
                this.logger.error(`Failed to stop execution ${executionId}: ${error.message}`, error.stack);
                throw new Error(`Failed to stop execution: ${error.message}`);
            })));
            this.logger.log(`Execution ${executionId} stopped successfully`);
            return response;
        }
        catch (error) {
            this.logger.error(`Error stopping execution ${executionId}: ${error.message}`, error.stack);
            throw error;
        }
    }
    async getWorkflows() {
        try {
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService
                .get(`${this.apiUrl}/workflows`, {
                headers: {
                    'X-N8N-API-KEY': this.apiKey,
                },
            })
                .pipe((0, operators_1.map)((response) => response.data), (0, operators_1.catchError)((error) => {
                this.logger.error(`Failed to get workflows: ${error.message}`, error.stack);
                throw new Error(`Failed to get workflows: ${error.message}`);
            })));
            return response;
        }
        catch (error) {
            this.logger.error(`Error getting workflows: ${error.message}`, error.stack);
            throw error;
        }
    }
    async healthCheck() {
        try {
            await (0, rxjs_1.firstValueFrom)(this.httpService
                .get(`${this.apiUrl}/health`, {
                headers: {
                    'X-N8N-API-KEY': this.apiKey,
                },
            })
                .pipe((0, operators_1.catchError)((error) => {
                this.logger.error(`n8n health check failed: ${error.message}`, error.stack);
                throw error;
            })));
            return true;
        }
        catch (error) {
            this.logger.error(`n8n health check failed: ${error.message}`);
            return false;
        }
    }
};
exports.N8nIntegrationService = N8nIntegrationService;
exports.N8nIntegrationService = N8nIntegrationService = N8nIntegrationService_1 = tslib_1.__decorate([
    (0, common_1.Injectable)(),
    tslib_1.__metadata("design:paramtypes", [config_1.ConfigService,
        axios_1.HttpService])
], N8nIntegrationService);
//# sourceMappingURL=n8n-integration.service.js.map