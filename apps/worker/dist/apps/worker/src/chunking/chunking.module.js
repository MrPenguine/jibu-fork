"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChunkingModule = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const chunking_service_1 = require("./chunking.service");
const strategy_chunking_service_1 = require("./strategy-chunking.service");
let ChunkingModule = class ChunkingModule {
};
exports.ChunkingModule = ChunkingModule;
exports.ChunkingModule = ChunkingModule = tslib_1.__decorate([
    (0, common_1.Module)({
        providers: [chunking_service_1.ChunkingService, strategy_chunking_service_1.StrategyChunkingService],
        exports: [chunking_service_1.ChunkingService, strategy_chunking_service_1.StrategyChunkingService],
    })
], ChunkingModule);
//# sourceMappingURL=chunking.module.js.map