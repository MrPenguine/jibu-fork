"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const database_module_1 = require("../../backend/src/core/database/database.module");
const storage_module_1 = require("../../backend/src/integrations/storage/storage.module");
const file_module_1 = require("../../backend/src/modules/v1/file/file.module");
const queue_module_1 = require("./queue/queue.module");
const chunking_module_1 = require("./chunking/chunking.module");
const embedding_module_1 = require("./embedding/embedding.module");
const vector_db_module_1 = require("./vector-db/vector-db.module");
const bull_1 = require("@nestjs/bull");
const queue_definitions_1 = require("@jibu/queue-definitions");
const n8n_module_1 = require("./n8n/n8n.module");
const scaling_module_1 = require("./scaling/scaling.module");
const common_module_1 = require("./common/common.module");
const schedule_1 = require("@nestjs/schedule");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = tslib_1.__decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: ['apps/worker/.env.local', 'apps/worker/.env', '.env.local', '.env'],
                cache: true,
            }),
            schedule_1.ScheduleModule.forRoot(),
            bull_1.BullModule.forRootAsync({
                imports: [config_1.ConfigModule],
                inject: [config_1.ConfigService],
                useFactory: (configService) => ({
                    redis: {
                        host: configService.get('REDIS_HOST') || 'localhost',
                        port: parseInt(configService.get('REDIS_PORT') || '6379', 10),
                        password: configService.get('REDIS_PASSWORD'),
                    },
                }),
            }),
            bull_1.BullModule.registerQueue({
                name: queue_definitions_1.QUEUE_NAMES.INDEXING,
                defaultJobOptions: {
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 2000
                    },
                    removeOnComplete: true,
                    removeOnFail: false,
                },
                limiter: {
                    max: 5,
                    duration: 1000,
                },
            }, {
                name: queue_definitions_1.QUEUE_NAMES.WORKFLOW_EXECUTION,
                defaultJobOptions: {
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 5000
                    },
                    removeOnComplete: true,
                    removeOnFail: false,
                },
                limiter: {
                    max: 10,
                    duration: 1000,
                },
            }, {
                name: queue_definitions_1.QUEUE_NAMES.WORKFLOW_PUBLISH,
                defaultJobOptions: {
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 5000
                    },
                    removeOnComplete: true,
                    removeOnFail: false,
                },
                limiter: {
                    max: 5,
                    duration: 1000,
                },
            }),
            database_module_1.DatabaseModule,
            storage_module_1.StorageModule,
            file_module_1.FileModule,
            queue_module_1.QueueModule,
            chunking_module_1.ChunkingModule,
            embedding_module_1.EmbeddingModule,
            vector_db_module_1.VectorDbModule,
            n8n_module_1.N8nModule,
            scaling_module_1.ScalingModule,
            common_module_1.CommonModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map