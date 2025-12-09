"use strict";
var StorageService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageService = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const storage_interface_1 = require("./interfaces/storage.interface");
let StorageService = StorageService_1 = class StorageService {
    constructor(storageService) {
        this.storageService = storageService;
        this.logger = new common_1.Logger(StorageService_1.name);
    }
    async upload(key, buffer, mimeType, orgId) {
        this.logger.log(`StorageService: Uploading file for organization ${orgId}`);
        this.logger.log(`StorageService: Key: ${key}, Size: ${buffer.byteLength} bytes, MimeType: ${mimeType}`);
        try {
            const result = await this.storageService.upload(key, buffer, mimeType, orgId);
            this.logger.log(`StorageService: Upload successful for organization ${orgId}, final key: ${result.key}`);
            return result;
        }
        catch (error) {
            this.logger.error(`StorageService: Upload failed for organization ${orgId}: ${error.message}`, error.stack);
            throw error;
        }
    }
    async getFileStream(key, orgId) {
        this.logger.log(`StorageService: Getting file stream for organization ${orgId}, key: ${key}`);
        try {
            return await this.storageService.getFileStream(key, orgId);
        }
        catch (error) {
            this.logger.error(`StorageService: Failed to get file stream for organization ${orgId}, key: ${key}`, error.stack);
            throw error;
        }
    }
    async getSignedDownloadUrl(key, orgId, expiresIn) {
        this.logger.log(`StorageService: Generating signed URL for organization ${orgId}, key: ${key}`);
        try {
            const url = await this.storageService.getSignedDownloadUrl(key, orgId, expiresIn);
            this.logger.log(`StorageService: Successfully generated signed URL for organization ${orgId}`);
            return url;
        }
        catch (error) {
            this.logger.error(`StorageService: Failed to generate signed URL for organization ${orgId}`, error.stack);
            throw error;
        }
    }
    async delete(key, orgId) {
        this.logger.log(`StorageService: Deleting file for organization ${orgId}, key: ${key}`);
        try {
            await this.storageService.delete(key, orgId);
            this.logger.log(`StorageService: Successfully deleted file for organization ${orgId}`);
        }
        catch (error) {
            this.logger.error(`StorageService: Failed to delete file for organization ${orgId}`, error.stack);
            throw error;
        }
    }
    async checkConnection() {
        this.logger.log('Checking storage connection via storage service');
        try {
            const result = await this.storageService.checkConnection();
            this.logger.log(`Storage connection result: ${result}`);
            return result;
        }
        catch (error) {
            this.logger.error(`Storage connection check error: ${error.message}`);
            throw error;
        }
    }
};
exports.StorageService = StorageService;
exports.StorageService = StorageService = StorageService_1 = tslib_1.__decorate([
    (0, common_1.Injectable)(),
    tslib_1.__param(0, (0, common_1.Inject)(storage_interface_1.IStorageService)),
    tslib_1.__metadata("design:paramtypes", [Object])
], StorageService);
//# sourceMappingURL=storage.service.js.map