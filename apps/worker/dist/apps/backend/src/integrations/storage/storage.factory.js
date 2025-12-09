"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storageServiceFactory = void 0;
const config_1 = require("@nestjs/config");
const storage_interface_1 = require("./interfaces/storage.interface");
const s3_storage_service_1 = require("./providers/s3/s3-storage.service");
exports.storageServiceFactory = {
    provide: storage_interface_1.IStorageService,
    useFactory: (configService, s3StorageService) => {
        const storageProvider = configService.get('STORAGE_PROVIDER');
        switch (storageProvider === null || storageProvider === void 0 ? void 0 : storageProvider.toLowerCase()) {
            case 's3':
                return s3StorageService;
            default:
                throw new Error(`Unsupported storage provider: ${storageProvider}`);
        }
    },
    inject: [config_1.ConfigService, s3_storage_service_1.S3StorageService],
};
//# sourceMappingURL=storage.factory.js.map