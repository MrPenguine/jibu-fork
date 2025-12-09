"use strict";
var VectorDbController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VectorDbController = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const vector_db_service_1 = require("./vector-db.service");
let VectorDbController = VectorDbController_1 = class VectorDbController {
    constructor(vectorDbService) {
        this.vectorDbService = vectorDbService;
        this.logger = new common_1.Logger(VectorDbController_1.name);
    }
    async search(collection, request) {
        this.logger.log(`Searching collection ${collection} with limit ${request.limit || 5}`);
        if (!request.vector || !Array.isArray(request.vector)) {
            return { error: 'Valid vector is required' };
        }
        try {
            const results = await this.vectorDbService.search(collection, {
                vector: request.vector,
                limit: request.limit || 5,
                with_payload: true,
                filter: request.filter
            });
            return {
                success: true,
                results
            };
        }
        catch (error) {
            this.logger.error(`Error searching collection ${collection}: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }
};
exports.VectorDbController = VectorDbController;
tslib_1.__decorate([
    (0, common_1.Post)(':collection/search'),
    tslib_1.__param(0, (0, common_1.Param)('collection')),
    tslib_1.__param(1, (0, common_1.Body)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String, Object]),
    tslib_1.__metadata("design:returntype", Promise)
], VectorDbController.prototype, "search", null);
exports.VectorDbController = VectorDbController = VectorDbController_1 = tslib_1.__decorate([
    (0, common_1.Controller)('api/vector-db'),
    tslib_1.__metadata("design:paramtypes", [vector_db_service_1.VectorDbService])
], VectorDbController);
//# sourceMappingURL=vector-db.controller.js.map