"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmbeddingModule = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const embedding_service_1 = require("./embedding.service");
const embedding_controller_1 = require("./embedding.controller");
let EmbeddingModule = class EmbeddingModule {
};
exports.EmbeddingModule = EmbeddingModule;
exports.EmbeddingModule = EmbeddingModule = tslib_1.__decorate([
    (0, common_1.Module)({
        providers: [embedding_service_1.EmbeddingService],
        exports: [embedding_service_1.EmbeddingService],
        controllers: [embedding_controller_1.EmbeddingController],
    })
], EmbeddingModule);
//# sourceMappingURL=embedding.module.js.map