"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueModule = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const bull_1 = require("@nestjs/bull");
const config_1 = require("@nestjs/config");
const queue_definitions_1 = require("@jibu/queue-definitions");
const queue_processor_1 = require("./queue.processor");
const indexing_processor_1 = require("./indexing.processor");
const database_module_1 = require("../../../backend/src/core/database/database.module");
const file_module_1 = require("../../../backend/src/modules/v1/file/file.module");
const chunking_module_1 = require("../chunking/chunking.module");
const embedding_module_1 = require("../embedding/embedding.module");
const vector_db_module_1 = require("../vector-db/vector-db.module");
let QueueModule = class QueueModule {
};
exports.QueueModule = QueueModule;
exports.QueueModule = QueueModule = tslib_1.__decorate([
    (0, common_1.Module)({
        imports: [
            bull_1.BullModule.forRootAsync({
                imports: [config_1.ConfigModule],
                useFactory: async (configService) => ({
                    redis: {
                        host: configService.get('REDIS_HOST', 'localhost'),
                        port: configService.get('REDIS_PORT', 6379),
                        password: configService.get('REDIS_PASSWORD'),
                    },
                    defaultJobOptions: {
                        attempts: 3,
                        backoff: {
                            type: 'exponential',
                            delay: 1000,
                        },
                        removeOnComplete: true,
                        removeOnFail: 100,
                    },
                }),
                inject: [config_1.ConfigService],
            }),
            bull_1.BullModule.registerQueue({ name: queue_definitions_1.QUEUE_NAMES.DEFAULT }, {
                name: queue_definitions_1.QUEUE_NAMES.INDEXING,
                defaultJobOptions: {
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 2000,
                    },
                    removeOnComplete: true,
                    removeOnFail: false,
                },
                limiter: {
                    max: 5,
                    duration: 1000,
                }
            }),
            database_module_1.DatabaseModule,
            file_module_1.FileModule,
            chunking_module_1.ChunkingModule,
            embedding_module_1.EmbeddingModule,
            vector_db_module_1.VectorDbModule,
        ],
        providers: [
            queue_processor_1.QueueProcessor,
            indexing_processor_1.IndexingProcessor,
        ],
        exports: [bull_1.BullModule],
    })
], QueueModule);
//# sourceMappingURL=queue.module.js.map