"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.N8nModule = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const config_1 = require("@nestjs/config");
const n8n_integration_service_1 = require("./n8n-integration.service");
const n8n_worker_config_1 = require("./n8n-worker.config");
const n8n_workflow_processor_1 = require("./n8n-workflow.processor");
const n8n_admin_client_1 = require("./n8n-admin.client");
const publish_workflow_processor_1 = require("./publish-workflow.processor");
const webhook_delivery_processor_1 = require("./webhook-delivery.processor");
const database_module_1 = require("../../../backend/src/core/database/database.module");
const cache_utils_1 = require("@jibu/cache-utils");
const redis_service_1 = require("../../../backend/src/core/redis/redis.service");
const webhook_url_service_1 = require("../../../backend/src/core/webhook/webhook-url.service");
let N8nModule = class N8nModule {
};
exports.N8nModule = N8nModule;
exports.N8nModule = N8nModule = tslib_1.__decorate([
    (0, common_1.Module)({
        imports: [
            database_module_1.DatabaseModule,
            axios_1.HttpModule.register({
                timeout: 10000,
                maxRedirects: 5,
            }),
            config_1.ConfigModule,
        ],
        providers: [
            n8n_integration_service_1.N8nIntegrationService,
            n8n_worker_config_1.N8nWorkerConfig,
            n8n_workflow_processor_1.N8nWorkflowProcessor,
            n8n_admin_client_1.N8nAdminClient,
            publish_workflow_processor_1.PublishWorkflowProcessor,
            webhook_delivery_processor_1.WebhookDeliveryProcessor,
            redis_service_1.RedisService,
            webhook_url_service_1.WebhookUrlService,
            { provide: cache_utils_1.REDIS_SERVICE_TOKEN, useExisting: redis_service_1.RedisService },
            {
                provide: cache_utils_1.WebhookCacheService,
                useFactory: (redisService) => new cache_utils_1.WebhookCacheService(redisService),
                inject: [cache_utils_1.REDIS_SERVICE_TOKEN],
            },
        ],
        exports: [n8n_integration_service_1.N8nIntegrationService, n8n_worker_config_1.N8nWorkerConfig, n8n_admin_client_1.N8nAdminClient, cache_utils_1.WebhookCacheService],
    })
], N8nModule);
//# sourceMappingURL=n8n.module.js.map