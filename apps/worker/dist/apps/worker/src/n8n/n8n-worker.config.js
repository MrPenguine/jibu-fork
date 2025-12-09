"use strict";
var N8nWorkerConfig_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.N8nWorkerConfig = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let N8nWorkerConfig = N8nWorkerConfig_1 = class N8nWorkerConfig {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(N8nWorkerConfig_1.name);
        this.logger.log('Initializing N8n Worker Configuration');
    }
    getRedisConfig() {
        return {
            host: this.configService.get('REDIS_HOST', 'localhost'),
            port: parseInt(this.configService.get('REDIS_PORT', '6379'), 10),
            password: this.configService.get('REDIS_PASSWORD'),
        };
    }
    getQueueConfig() {
        return {
            prefix: 'bull',
            defaultJobOptions: {
                attempts: this.getWorkerRetryAttempts(),
                backoff: {
                    type: 'exponential',
                    delay: 5000,
                },
                removeOnComplete: true,
                removeOnFail: false,
            },
            limiter: {
                max: this.getWorkerConcurrency(),
                duration: 1000,
            },
        };
    }
    getN8nApiConfig() {
        return {
            url: this.configService.get('N8N_API_URL'),
            key: this.configService.get('N8N_API_KEY'),
        };
    }
    getWorkerConcurrency() {
        return parseInt(this.configService.get('N8N_WORKER_CONCURRENCY', '5'), 10);
    }
    getWorkerTimeout() {
        return parseInt(this.configService.get('N8N_WORKER_TIMEOUT', '300000'), 10);
    }
    getWorkerRetryAttempts() {
        return parseInt(this.configService.get('N8N_WORKER_RETRY_ATTEMPTS', '3'), 10);
    }
    getWorkerMemoryLimit() {
        return parseInt(this.configService.get('N8N_WORKER_MEMORY_LIMIT', '512'), 10);
    }
    getMinWorkers() {
        return parseInt(this.configService.get('N8N_MIN_WORKERS', '1'), 10);
    }
    getMaxWorkers() {
        return parseInt(this.configService.get('N8N_MAX_WORKERS', '10'), 10);
    }
    getQueueThreshold() {
        return parseInt(this.configService.get('N8N_QUEUE_THRESHOLD', '100'), 10);
    }
    getWorkerConfig() {
        return {
            redis: this.getRedisConfig(),
            queue: this.getQueueConfig(),
            n8n: this.getN8nApiConfig(),
            worker: {
                concurrency: this.getWorkerConcurrency(),
                timeout: this.getWorkerTimeout(),
                retryAttempts: this.getWorkerRetryAttempts(),
                memoryLimit: this.getWorkerMemoryLimit(),
                minWorkers: this.getMinWorkers(),
                maxWorkers: this.getMaxWorkers(),
                queueThreshold: this.getQueueThreshold(),
            },
        };
    }
};
exports.N8nWorkerConfig = N8nWorkerConfig;
exports.N8nWorkerConfig = N8nWorkerConfig = N8nWorkerConfig_1 = tslib_1.__decorate([
    (0, common_1.Injectable)(),
    tslib_1.__metadata("design:paramtypes", [config_1.ConfigService])
], N8nWorkerConfig);
//# sourceMappingURL=n8n-worker.config.js.map