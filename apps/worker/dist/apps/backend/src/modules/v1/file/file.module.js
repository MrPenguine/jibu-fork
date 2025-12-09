"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileModule = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const file_service_1 = require("./file.service");
const file_controller_1 = require("./file.controller");
const database_module_1 = require("../../../core/database/database.module");
const storage_module_1 = require("../../../integrations/storage/storage.module");
let FileModule = class FileModule {
};
exports.FileModule = FileModule;
exports.FileModule = FileModule = tslib_1.__decorate([
    (0, common_1.Module)({
        imports: [
            database_module_1.DatabaseModule,
            storage_module_1.StorageModule,
        ],
        providers: [file_service_1.FileService],
        controllers: [file_controller_1.FileController],
        exports: [file_service_1.FileService],
    })
], FileModule);
//# sourceMappingURL=file.module.js.map