"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VectorDbModule = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const vector_db_service_1 = require("./vector-db.service");
const vector_db_controller_1 = require("./vector-db.controller");
let VectorDbModule = class VectorDbModule {
};
exports.VectorDbModule = VectorDbModule;
exports.VectorDbModule = VectorDbModule = tslib_1.__decorate([
    (0, common_1.Module)({
        imports: [config_1.ConfigModule],
        providers: [vector_db_service_1.VectorDbService],
        exports: [vector_db_service_1.VectorDbService],
        controllers: [vector_db_controller_1.VectorDbController],
    })
], VectorDbModule);
//# sourceMappingURL=vector-db.module.js.map