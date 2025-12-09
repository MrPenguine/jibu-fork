"use strict";
var N8nAdminClient_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.N8nAdminClient = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = require("@nestjs/axios");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
let N8nAdminClient = N8nAdminClient_1 = class N8nAdminClient {
    constructor(configService, http) {
        this.configService = configService;
        this.http = http;
        this.logger = new common_1.Logger(N8nAdminClient_1.name);
        const raw = (this.configService.get('N8N_API_URL') || '').replace(/\/$/, '');
        if (/\/api(\/v\d+)?$/.test(raw)) {
            this.apiBase = /\/api$/.test(raw) ? `${raw}/v1` : raw;
        }
        else {
            this.apiBase = `${raw}/api/v1`;
        }
        this.apiKey = this.configService.get('N8N_API_KEY');
        if (!this.apiKey) {
            this.logger.error('N8N_API_KEY is missing; cannot call n8n API');
            throw new Error('Missing N8N_API_KEY');
        }
        const mask = (k) => (k.length > 12 ? `${k.slice(0, 6)}...${k.slice(-4)}` : '***');
        this.logger.log(`n8n apiBase resolved to: ${this.apiBase}; using key=${mask(this.apiKey)}`);
    }
    headers() {
        return { 'X-N8N-API-KEY': this.apiKey, 'Content-Type': 'application/json' };
    }
    async createWorkflow(workflow) {
        const url = `${this.apiBase}/workflows`;
        const res = await (0, rxjs_1.firstValueFrom)(this.http.post(url, workflow, { headers: this.headers() }).pipe((0, operators_1.map)((r) => r.data), (0, operators_1.catchError)((err) => {
            var _a, _b;
            const status = (_a = err === null || err === void 0 ? void 0 : err.response) === null || _a === void 0 ? void 0 : _a.status;
            const data = (_b = err === null || err === void 0 ? void 0 : err.response) === null || _b === void 0 ? void 0 : _b.data;
            this.logger.error(`Failed to create workflow [POST ${url}] status=${status}: ${err.message} body=${JSON.stringify(data)}`);
            throw err;
        })));
        return res;
    }
    async updateWorkflow(id, workflow) {
        const url = `${this.apiBase}/workflows/${id}`;
        const res = await (0, rxjs_1.firstValueFrom)(this.http.put(url, workflow, { headers: this.headers() }).pipe((0, operators_1.map)((r) => r.data), (0, operators_1.catchError)((err) => {
            var _a, _b;
            const status = (_a = err === null || err === void 0 ? void 0 : err.response) === null || _a === void 0 ? void 0 : _a.status;
            const data = (_b = err === null || err === void 0 ? void 0 : err.response) === null || _b === void 0 ? void 0 : _b.data;
            this.logger.error(`Failed to update workflow ${id} [PUT ${url}] status=${status}: ${err.message} body=${JSON.stringify(data)}`);
            throw err;
        })));
        return res;
    }
    async getWorkflow(id) {
        const url = `${this.apiBase}/workflows/${id}`;
        const res = await (0, rxjs_1.firstValueFrom)(this.http.get(url, { headers: this.headers() }).pipe((0, operators_1.map)((r) => r.data), (0, operators_1.catchError)((err) => {
            var _a, _b;
            const status = (_a = err === null || err === void 0 ? void 0 : err.response) === null || _a === void 0 ? void 0 : _a.status;
            const data = (_b = err === null || err === void 0 ? void 0 : err.response) === null || _b === void 0 ? void 0 : _b.data;
            this.logger.error(`Failed to fetch workflow ${id} [GET ${url}] status=${status}: ${err.message} body=${JSON.stringify(data)}`);
            throw err;
        })));
        return res;
    }
    isNotFound(err) {
        var _a;
        return ((_a = err === null || err === void 0 ? void 0 : err.response) === null || _a === void 0 ? void 0 : _a.status) === 404;
    }
    async workflowExists(id) {
        try {
            await this.getWorkflow(id);
            return true;
        }
        catch (err) {
            if (this.isNotFound(err))
                return false;
            throw err;
        }
    }
    async setActive(id, active) {
        const url = `${this.apiBase}/workflows/${id}/${active ? 'activate' : 'deactivate'}`;
        const res = await (0, rxjs_1.firstValueFrom)(this.http.post(url, {}, { headers: this.headers() }).pipe((0, operators_1.map)((r) => r.data), (0, operators_1.catchError)((err) => {
            var _a, _b;
            const status = (_a = err === null || err === void 0 ? void 0 : err.response) === null || _a === void 0 ? void 0 : _a.status;
            const data = (_b = err === null || err === void 0 ? void 0 : err.response) === null || _b === void 0 ? void 0 : _b.data;
            this.logger.error(`Failed to set active=${active} for workflow ${id} [POST ${url}] status=${status}: ${err.message} body=${JSON.stringify(data)}`);
            throw err;
        })));
        return res;
    }
    async listWorkflows(params) {
        const qp = new URLSearchParams();
        if (params === null || params === void 0 ? void 0 : params.name)
            qp.set('name', params.name);
        if (params === null || params === void 0 ? void 0 : params.limit)
            qp.set('limit', String(params.limit));
        const url = `${this.apiBase}/workflows${qp.toString() ? `?${qp.toString()}` : ''}`;
        const res = await (0, rxjs_1.firstValueFrom)(this.http.get(url, { headers: this.headers() }).pipe((0, operators_1.map)((r) => r.data), (0, operators_1.catchError)((err) => {
            var _a, _b;
            const status = (_a = err === null || err === void 0 ? void 0 : err.response) === null || _a === void 0 ? void 0 : _a.status;
            const data = (_b = err === null || err === void 0 ? void 0 : err.response) === null || _b === void 0 ? void 0 : _b.data;
            this.logger.error(`Failed to list workflows [GET ${url}] status=${status}: ${err.message} body=${JSON.stringify(data)}`);
            throw err;
        })));
        return res;
    }
    async findWorkflowByName(name) {
        const res = await this.listWorkflows({ name, limit: 5 });
        const arr = Array.isArray(res === null || res === void 0 ? void 0 : res.data) ? res.data : [];
        const found = arr.find((w) => ((w === null || w === void 0 ? void 0 : w.name) || '').toLowerCase() === name.toLowerCase());
        return found || null;
    }
};
exports.N8nAdminClient = N8nAdminClient;
exports.N8nAdminClient = N8nAdminClient = N8nAdminClient_1 = tslib_1.__decorate([
    (0, common_1.Injectable)(),
    tslib_1.__metadata("design:paramtypes", [config_1.ConfigService,
        axios_1.HttpService])
], N8nAdminClient);
//# sourceMappingURL=n8n-admin.client.js.map