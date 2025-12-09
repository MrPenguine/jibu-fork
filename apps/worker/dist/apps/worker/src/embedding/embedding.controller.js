"use strict";
var EmbeddingController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmbeddingController = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const embedding_service_1 = require("./embedding.service");
let EmbeddingController = EmbeddingController_1 = class EmbeddingController {
    constructor(embeddingService) {
        this.embeddingService = embeddingService;
        this.logger = new common_1.Logger(EmbeddingController_1.name);
    }
    async generateEmbedding(request) {
        this.logger.log(`Generating embedding for text: ${request.text.substring(0, 30)}...`);
        if (!request.text) {
            return { error: 'Text is required' };
        }
        try {
            const embedding = await this.embeddingService.embedText(request.text);
            return {
                success: true,
                embedding
            };
        }
        catch (error) {
            this.logger.error(`Error generating embedding: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }
};
exports.EmbeddingController = EmbeddingController;
tslib_1.__decorate([
    (0, common_1.Post)('generate'),
    tslib_1.__param(0, (0, common_1.Body)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [Object]),
    tslib_1.__metadata("design:returntype", Promise)
], EmbeddingController.prototype, "generateEmbedding", null);
exports.EmbeddingController = EmbeddingController = EmbeddingController_1 = tslib_1.__decorate([
    (0, common_1.Controller)('api/embedding'),
    tslib_1.__metadata("design:paramtypes", [embedding_service_1.EmbeddingService])
], EmbeddingController);
//# sourceMappingURL=embedding.controller.js.map