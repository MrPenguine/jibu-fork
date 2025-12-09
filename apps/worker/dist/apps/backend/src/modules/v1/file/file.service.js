"use strict";
var FileService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileService = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../core/database/prisma.service");
const storage_interface_1 = require("../../../integrations/storage/interfaces/storage.interface");
const file_response_dto_1 = require("./dto/file-response.dto");
const list_files_dto_1 = require("./dto/list-files.dto");
const class_transformer_1 = require("class-transformer");
const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
};
const sanitizeFilename = (filename) => {
    return filename.replace(/[/\\?%*:|"<>]/g, '_');
};
let FileService = FileService_1 = class FileService {
    constructor(prisma, storageService) {
        this.prisma = prisma;
        this.storageService = storageService;
        this.logger = new common_1.Logger(FileService_1.name);
    }
    async uploadAndCreateFileMetadata(workspaceId, userId, file) {
        const sanitizedName = sanitizeFilename(file.originalname);
        const fileId = generateId();
        const storageKey = `${fileId}/${sanitizedName}`;
        let cleanUserId = userId;
        if (userId === null || userId === void 0 ? void 0 : userId.includes(',')) {
            cleanUserId = userId.split(',')[0];
            this.logger.warn(`Received comma-separated userId: ${userId}, using first value: ${cleanUserId}`);
        }
        else if (Array.isArray(userId)) {
            cleanUserId = userId[0];
            this.logger.warn(`Received array userId: ${userId}, using first value: ${cleanUserId}`);
        }
        if (!cleanUserId || typeof cleanUserId !== 'string') {
            this.logger.error(`Invalid userId provided: ${userId}. Using default placeholder.`);
            cleanUserId = 'unknown-user';
        }
        this.logger.log(`Uploading file ${sanitizedName} for workspace ${workspaceId} by user ${cleanUserId}`);
        this.logger.log(`File details: size=${file.size} bytes, type=${file.mimetype}`);
        try {
            const workspace = await this.prisma.workspace.findUnique({
                where: { id: workspaceId },
            });
            if (!workspace) {
                throw new common_1.NotFoundException(`Workspace with ID ${workspaceId} not found`);
            }
            const uploadResult = await this.storageService.upload(storageKey, file.buffer, file.mimetype, workspaceId);
            const fileRecord = await this.prisma.file.create({
                data: {
                    name: sanitizedName,
                    storageProvider: 's3',
                    storageKey: uploadResult.key,
                    mimeType: file.mimetype,
                    sizeBytes: file.size,
                    workspaceId: workspaceId,
                    userId: cleanUserId,
                },
            });
            this.logger.log(`File ${fileRecord.id} uploaded and metadata saved with workspace ${workspaceId}`);
            return (0, class_transformer_1.plainToInstance)(file_response_dto_1.FileResponseDto, fileRecord);
        }
        catch (error) {
            this.logger.error(`File upload failed for workspace ${workspaceId}: ${error.message}`, error.stack);
            throw error;
        }
    }
    async findFilesByWorkspace(workspaceId, paginationOptions) {
        var _a, _b;
        const page = (_a = paginationOptions === null || paginationOptions === void 0 ? void 0 : paginationOptions.page) !== null && _a !== void 0 ? _a : 1;
        const pageSize = (_b = paginationOptions === null || paginationOptions === void 0 ? void 0 : paginationOptions.pageSize) !== null && _b !== void 0 ? _b : 10;
        const skip = (page - 1) * pageSize;
        try {
            const [files, total] = await Promise.all([
                this.prisma.file.findMany({
                    where: { workspaceId: workspaceId },
                    take: pageSize,
                    skip,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        user: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                email: true,
                            }
                        }
                    }
                }),
                this.prisma.file.count({ where: { workspaceId: workspaceId } }),
            ]);
            return (0, class_transformer_1.plainToInstance)(list_files_dto_1.ListFilesDto, {
                data: files.map(file => {
                    const fileDto = (0, class_transformer_1.plainToInstance)(file_response_dto_1.FileResponseDto, file);
                    if (file.user) {
                        fileDto.uploader = {
                            id: file.user.id,
                            firstName: file.user.firstName,
                            lastName: file.user.lastName,
                            email: file.user.email,
                        };
                    }
                    return fileDto;
                }),
                total,
                page,
                pageSize,
            });
        }
        catch (error) {
            this.logger.error(`Error finding files for workspace ${workspaceId}: ${error.message}`, error.stack);
            throw error;
        }
    }
    async findFileById(fileId, workspaceId) {
        const file = await this.prisma.file.findFirst({
            where: { id: fileId, workspaceId: workspaceId },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    }
                }
            }
        });
        if (!file) {
            throw new common_1.NotFoundException(`File with ID ${fileId} not found`);
        }
        const fileDto = (0, class_transformer_1.plainToInstance)(file_response_dto_1.FileResponseDto, file);
        if (file.user) {
            fileDto.uploader = {
                id: file.user.id,
                firstName: file.user.firstName,
                lastName: file.user.lastName,
                email: file.user.email,
            };
        }
        return fileDto;
    }
    async getFileMetadataForDownload(fileId, workspaceId) {
        const file = await this.prisma.file.findFirst({
            where: { id: fileId, workspaceId: workspaceId },
            select: { storageKey: true, name: true },
        });
        if (!file) {
            throw new common_1.NotFoundException(`File with ID ${fileId} not found`);
        }
        return file;
    }
    async getDownloadUrl(fileId, workspaceId) {
        const metadata = await this.getFileMetadataForDownload(fileId, workspaceId);
        return this.storageService.getSignedDownloadUrl(metadata.storageKey, workspaceId);
    }
    async deleteFile(fileId, workspaceId, userId, isAdmin = false) {
        let cleanUserId = userId;
        if (userId === null || userId === void 0 ? void 0 : userId.includes(',')) {
            cleanUserId = userId.split(',')[0];
            this.logger.warn(`Received comma-separated userId for deletion: ${userId}, using first value: ${cleanUserId}`);
        }
        else if (Array.isArray(userId)) {
            cleanUserId = userId[0];
            this.logger.warn(`Received array userId for deletion: ${userId}, using first value: ${cleanUserId}`);
        }
        if (!cleanUserId || typeof cleanUserId !== 'string') {
            this.logger.error(`Invalid userId provided for deletion: ${userId}. Using default placeholder.`);
            cleanUserId = 'unknown-user';
        }
        this.logger.log(`Delete request for file ${fileId} in workspace ${workspaceId} by user ${cleanUserId}`);
        const file = await this.prisma.file.findFirst({
            where: { id: fileId, workspaceId: workspaceId },
        });
        if (!file) {
            throw new common_1.NotFoundException(`File with ID ${fileId} not found`);
        }
        if (!isAdmin && file.userId !== cleanUserId) {
            this.logger.warn(`Permission denied: User ${cleanUserId} attempting to delete file ${fileId} owned by ${file.userId}`);
            throw new common_1.BadRequestException('You do not have permission to delete this file');
        }
        try {
            await this.storageService.delete(file.storageKey, workspaceId);
            await this.prisma.file.delete({
                where: { id: fileId },
            });
            this.logger.log(`File ${fileId} deleted successfully for workspace ${workspaceId} by user ${cleanUserId}`);
        }
        catch (error) {
            this.logger.error(`Failed to delete file ${fileId}: ${error.message}`, error.stack);
            throw error;
        }
    }
};
exports.FileService = FileService;
exports.FileService = FileService = FileService_1 = tslib_1.__decorate([
    (0, common_1.Injectable)(),
    tslib_1.__param(1, (0, common_1.Inject)(storage_interface_1.IStorageService)),
    tslib_1.__metadata("design:paramtypes", [prisma_service_1.PrismaService, Object])
], FileService);
//# sourceMappingURL=file.service.js.map