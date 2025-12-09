"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
const os = require("os");
const crypto_1 = require("crypto");
const g = global;
if (!('crypto' in g)) {
    g.crypto = {};
}
if (!g.crypto.randomUUID) {
    g.crypto.randomUUID = crypto_1.randomUUID;
}
async function bootstrap() {
    const logger = new common_1.Logger('Worker');
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    });
    const numCPUs = os.cpus().length;
    const threads = Math.max(2, Math.min(numCPUs - 1, 4));
    process.env.INDEXING_CONCURRENCY = String(threads);
    logger.log(`Starting worker with ${threads} threads for concurrent processing`);
    await app.listen(parseInt(process.env.WORKER_PORT || '3001', 10));
    logger.log(`Worker running on port ${process.env.WORKER_PORT || '3001'}`);
}
bootstrap();
//# sourceMappingURL=main.js.map