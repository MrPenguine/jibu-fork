"use strict";
var PublishWorkflowProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublishWorkflowProcessor = void 0;
const tslib_1 = require("tslib");
const bull_1 = require("@nestjs/bull");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../backend/src/core/database/prisma.service");
const queue_definitions_1 = require("@jibu/queue-definitions");
const n8n_admin_client_1 = require("./n8n-admin.client");
const cache_utils_1 = require("@jibu/cache-utils");
let PublishWorkflowProcessor = PublishWorkflowProcessor_1 = class PublishWorkflowProcessor {
    constructor(prisma, n8nAdmin, webhookCache) {
        this.prisma = prisma;
        this.n8nAdmin = n8nAdmin;
        this.webhookCache = webhookCache;
        this.logger = new common_1.Logger(PublishWorkflowProcessor_1.name);
    }
    onModuleInit() {
        this.logger.log(`[DIAGNOSTIC] 🎯 PublishWorkflowProcessor initialized and registered for queue: ${queue_definitions_1.QUEUE_NAMES.WORKFLOW_PUBLISH}`);
        this.logger.log(`[DIAGNOSTIC] 📋 Listening for job: ${queue_definitions_1.JOB_NAMES.PUBLISH_WORKFLOW}`);
    }
    onActive(job) {
        this.logger.log(`[DIAGNOSTIC] ⚡ Job ${job.id} is now active - Processing workflow ${job.data.workflowId}`);
    }
    onCompleted(job, result) {
        this.logger.log(`[DIAGNOSTIC] ✅ Job ${job.id} completed successfully for workflow ${job.data.workflowId}`);
    }
    onFailed(job, err) {
        this.logger.error(`[DIAGNOSTIC] ❌ Job ${job.id} failed for workflow ${job.data.workflowId}: ${err.message}`, err.stack);
    }
    async handle(job) {
        var _a, _b;
        const { workflowId, workspaceId, n8nWorkflowDbId, activate = false, force = false } = job.data;
        this.logger.log(`[DIAGNOSTIC] 🔄 Starting to process publish job ${job.id}`);
        this.logger.log(`[DIAGNOSTIC] Publishing workflow ${workflowId} (workspace ${workspaceId}), activate=${activate}`);
        try {
            this.logger.log(`[DIAGNOSTIC] Step 1: Loading workflow from database...`);
            const workflow = await this.prisma.workflow.findFirst({
                where: { id: workflowId, workspaceId },
                include: { n8nWorkflow: true },
            });
            if (!workflow) {
                throw new Error(`Workflow not found: ${workflowId} in workspace ${workspaceId}`);
            }
            this.logger.log(`[DIAGNOSTIC] ✅ Step 1 complete: Workflow loaded: ${workflow.name}`);
            this.logger.log(`[DIAGNOSTIC] Step 2: Loading N8nWorkflow row...`);
            const n8nRowId = n8nWorkflowDbId || workflow.n8nWorkflowId;
            const n8nRow = await this.prisma.n8nWorkflow.findFirst({
                where: n8nRowId ? { id: n8nRowId } : { workflows: { some: { id: workflowId } } },
            });
            if (!n8nRow || !n8nRow.workflowJson) {
                throw new Error('Compiled n8n JSON not found; run compile first');
            }
            this.logger.log(`[DIAGNOSTIC] ✅ Step 2 complete: N8nWorkflow row loaded`);
            const payload = n8nRow.workflowJson;
            this.logger.log(`[DIAGNOSTIC] Step 3: Sanitizing workflow payload...`);
            const sanitizeWorkflow = (wf) => {
                var _a, _b, _c, _d;
                const allowedTop = ['name', 'nodes', 'connections', 'settings'];
                const seen = new Set();
                const nodes = (wf.nodes || []).filter((n) => {
                    var _a;
                    const name = (_a = n === null || n === void 0 ? void 0 : n.name) !== null && _a !== void 0 ? _a : '';
                    if (seen.has(name))
                        return false;
                    seen.add(name);
                    return true;
                }).map((n) => {
                    const allowedNode = ['id', 'name', 'type', 'typeVersion', 'position', 'parameters', 'credentials', 'webhookId', 'disabled', 'notes', 'alwaysOutputData', 'retryOnFail', 'maxTries', 'waitBetweenTries', 'onError'];
                    const pruned = {};
                    for (const k of allowedNode)
                        if (k in n)
                            pruned[k] = n[k];
                    return pruned;
                });
                const out = { nodes };
                for (const k of allowedTop) {
                    if (k === 'nodes')
                        continue;
                    if (k in wf)
                        out[k] = wf[k];
                }
                if (!out.settings)
                    out.settings = { executionOrder: 'v1' };
                if (wf.connections)
                    out.connections = wf.connections;
                const webhookName = ((_a = nodes.find((n) => n.type === 'n8n-nodes-base.webhook')) === null || _a === void 0 ? void 0 : _a.name) || 'Webhook';
                const agentName = ((_b = nodes.find((n) => n.type === '@n8n/n8n-nodes-langchain.agent')) === null || _b === void 0 ? void 0 : _b.name) || 'AI Agent';
                const providerNode = nodes.find((n) => typeof n.type === 'string' && n.type.startsWith('@n8n/n8n-nodes-langchain.lmChat'));
                const providerName = providerNode === null || providerNode === void 0 ? void 0 : providerNode.name;
                out.connections = out.connections || {};
                if (webhookName && agentName) {
                    const hasMain = Array.isArray((_c = out.connections[webhookName]) === null || _c === void 0 ? void 0 : _c.main) && out.connections[webhookName].main.some((arr) => Array.isArray(arr) && arr.some((c) => (c === null || c === void 0 ? void 0 : c.node) === agentName && (c === null || c === void 0 ? void 0 : c.type) === 'main'));
                    if (!hasMain) {
                        out.connections[webhookName] = out.connections[webhookName] || {};
                        out.connections[webhookName].main = out.connections[webhookName].main || [];
                        out.connections[webhookName].main.push([{ node: agentName, type: 'main', index: 0 }]);
                    }
                }
                if (providerName && agentName) {
                    const hasModel = Array.isArray((_d = out.connections[providerName]) === null || _d === void 0 ? void 0 : _d.ai_languageModel) && out.connections[providerName].ai_languageModel.some((arr) => Array.isArray(arr) && arr.some((c) => (c === null || c === void 0 ? void 0 : c.node) === agentName && (c === null || c === void 0 ? void 0 : c.type) === 'ai_languageModel'));
                    if (!hasModel) {
                        out.connections[providerName] = out.connections[providerName] || {};
                        out.connections[providerName].ai_languageModel = out.connections[providerName].ai_languageModel || [];
                        out.connections[providerName].ai_languageModel.push([{ node: agentName, type: 'ai_languageModel', index: 0 }]);
                    }
                }
                return out;
            };
            const body = sanitizeWorkflow(payload);
            this.logger.log(`[DIAGNOSTIC] ✅ Step 3 complete: Payload sanitized`);
            let liveId = n8nRow.n8nWorkflowId || undefined;
            this.logger.log(`[DIAGNOSTIC] Step 4: Checking if workflow exists in n8n (liveId: ${liveId})...`);
            if (liveId) {
                const exists = await this.n8nAdmin.workflowExists(liveId);
                if (!exists) {
                    this.logger.warn(`[DIAGNOSTIC] ⚠️ Live n8n workflow ${liveId} not found; will create a new one.`);
                    liveId = undefined;
                }
            }
            if (!liveId) {
                this.logger.log(`[DIAGNOSTIC] No liveId. Checking for existing workflow by name: "${body.name}"`);
                const byName = (body === null || body === void 0 ? void 0 : body.name) ? await this.n8nAdmin.findWorkflowByName(body.name) : null;
                if (byName === null || byName === void 0 ? void 0 : byName.id) {
                    liveId = String(byName.id);
                    this.logger.log(`[DIAGNOSTIC] Found by name. Decision: UPDATE_BY_NAME -> ${liveId}`);
                    await this.n8nAdmin.updateWorkflow(liveId, body);
                }
                else {
                    this.logger.log(`[DIAGNOSTIC] Not found by name. Decision: CREATE_STUB`);
                    const stub = { name: body.name, nodes: [], connections: {}, settings: { executionOrder: 'v1' } };
                    const created = await this.n8nAdmin.createWorkflow(stub);
                    liveId = String(created.id);
                    this.logger.log(`[DIAGNOSTIC] Created stub with ID: ${liveId}. Populating with full definition...`);
                    await this.n8nAdmin.updateWorkflow(liveId, body);
                }
            }
            else {
                this.logger.log(`[DIAGNOSTIC] Found liveId. Decision: UPDATE_BY_ID -> ${liveId}`);
                try {
                    await this.n8nAdmin.updateWorkflow(liveId, body);
                }
                catch (err) {
                    if (((_a = err === null || err === void 0 ? void 0 : err.response) === null || _a === void 0 ? void 0 : _a.status) === 404) {
                        this.logger.warn(`[DIAGNOSTIC] ⚠️ UPDATE failed with 404 for ${liveId}; falling back to CREATE.`);
                        const created = await this.n8nAdmin.createWorkflow(body);
                        liveId = String(created.id);
                    }
                    else {
                        throw err;
                    }
                }
            }
            this.logger.log(`[DIAGNOSTIC] ✅ Step 4 complete: n8n workflow created/updated. Live ID: ${liveId}`);
            this.logger.log(`[DIAGNOSTIC] Step 5: Persisting n8n live ID to database...`);
            await this.prisma.n8nWorkflow.update({ where: { id: n8nRow.id }, data: { n8nWorkflowId: liveId } });
            this.logger.log(`[DIAGNOSTIC] ✅ Step 5 complete: Persisted live ID`);
            this.logger.log(`[DIAGNOSTIC] Step 6: Handling activation...`);
            if (activate) {
                await this.n8nAdmin.setActive(liveId, true);
                this.logger.log(`[DIAGNOSTIC] ✅ Step 6 complete: Workflow activated in n8n`);
            }
            else {
                this.logger.log(`[DIAGNOSTIC] Step 6 complete: Workflow activation skipped`);
            }
            this.logger.log(`[DIAGNOSTIC] Step 7: Persisting final status to database...`);
            const webhookNode = (payload.nodes || []).find((n) => n.type === 'n8n-nodes-base.webhook');
            const webhookPath = ((_b = webhookNode === null || webhookNode === void 0 ? void 0 : webhookNode.parameters) === null || _b === void 0 ? void 0 : _b.path) ? String(webhookNode.parameters.path) : undefined;
            const baseEnv = process.env.N8N_WEBHOOK_URL || process.env.N8N_PUBLIC_URL || process.env.N8N_API_URL || '';
            const baseUrl = String(baseEnv).replace(/\/$/, '').replace(/\/?api(?:\/v\d+)?$/, '');
            let webhookId = webhookPath ? webhookPath.trim() : undefined;
            if (webhookId) {
                webhookId = webhookId.replace(/^\/+/, '');
                const segments = webhookId.split('/');
                if (segments.length >= 4 && segments[0] === 'api' && segments[1] === 'n8n' && segments[2] === 'hooks') {
                    webhookId = segments[3];
                }
                else if (segments.length > 1) {
                    webhookId = segments[segments.length - 1];
                }
            }
            const webhookUrl = webhookId ? `${baseUrl}/webhook/${webhookId}` : undefined;
            await this.prisma.n8nWorkflow.update({
                where: { id: n8nRow.id },
                data: { isActive: !!activate, webhookUrl, lastValidatedAt: new Date() },
            });
            this.logger.log(`[DIAGNOSTIC] ✅ Step 7 complete: Final status persisted`);
            this.logger.log(`[DIAGNOSTIC] Step 8: Invalidating webhook cache...`);
            await this.webhookCache.invalidate(workflowId);
            if (webhookUrl) {
                const isVoiceWorkflow = await this.isVoiceWorkflow(workflowId);
                if (isVoiceWorkflow) {
                    this.logger.log(`[DIAGNOSTIC] Voice workflow detected, adding 100ms delay for n8n propagation`);
                    await this.delay(100);
                }
                await this.webhookCache.setWebhookUrl(workflowId, webhookUrl, isVoiceWorkflow);
                this.logger.log(`[DIAGNOSTIC] ✅ Step 8 complete: Cache invalidated and refreshed`);
            }
            else {
                this.logger.log(`[DIAGNOSTIC] ✅ Step 8 complete: Cache invalidated (no webhook URL to cache)`);
            }
            const result = { n8nWorkflowId: liveId, activated: activate, webhookUrl };
            this.logger.log(`[DIAGNOSTIC] 🎉 Publish completed successfully! Result: ${JSON.stringify(result)}`);
            return result;
        }
        catch (error) {
            const err = error;
            this.logger.error(`[DIAGNOSTIC] ❌ Fatal error in publish workflow processor: ${err.message}`, err.stack);
            throw err;
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
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};
exports.PublishWorkflowProcessor = PublishWorkflowProcessor;
tslib_1.__decorate([
    (0, bull_1.OnQueueActive)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [Object]),
    tslib_1.__metadata("design:returntype", void 0)
], PublishWorkflowProcessor.prototype, "onActive", null);
tslib_1.__decorate([
    (0, bull_1.OnQueueCompleted)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [Object, Object]),
    tslib_1.__metadata("design:returntype", void 0)
], PublishWorkflowProcessor.prototype, "onCompleted", null);
tslib_1.__decorate([
    (0, bull_1.OnQueueFailed)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [Object, Error]),
    tslib_1.__metadata("design:returntype", void 0)
], PublishWorkflowProcessor.prototype, "onFailed", null);
tslib_1.__decorate([
    (0, bull_1.Process)(queue_definitions_1.JOB_NAMES.PUBLISH_WORKFLOW),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [Object]),
    tslib_1.__metadata("design:returntype", Promise)
], PublishWorkflowProcessor.prototype, "handle", null);
exports.PublishWorkflowProcessor = PublishWorkflowProcessor = PublishWorkflowProcessor_1 = tslib_1.__decorate([
    (0, common_1.Injectable)(),
    (0, bull_1.Processor)(queue_definitions_1.QUEUE_NAMES.WORKFLOW_PUBLISH),
    tslib_1.__metadata("design:paramtypes", [prisma_service_1.PrismaService,
        n8n_admin_client_1.N8nAdminClient,
        cache_utils_1.WebhookCacheService])
], PublishWorkflowProcessor);
//# sourceMappingURL=publish-workflow.processor.js.map