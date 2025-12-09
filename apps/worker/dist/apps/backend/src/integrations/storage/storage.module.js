"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageModule = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const s3_storage_service_1 = require("./providers/s3/s3-storage.service");
const storage_factory_1 = require("./storage.factory");
const storage_service_1 = require("./storage.service");
const storage_interface_1 = require("./interfaces/storage.interface");
let StorageModule = class StorageModule {
};
exports.StorageModule = StorageModule;
exports.StorageModule = StorageModule = tslib_1.__decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule,
        ],
        providers: [
            s3_storage_service_1.S3StorageService,
            storage_factory_1.storageServiceFactory,
            storage_service_1.StorageService,
        ],
        exports: [
            storage_service_1.StorageService,
            storage_interface_1.IStorageService,
        ],
    })
], StorageModule);
//# sourceMappingURL=storage.module.js.map