"use strict";
var FileController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileController = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../../../core/auth/guards/jwt-auth.guard");
const file_service_1 = require("./file.service");
const file_response_dto_1 = require("./dto/file-response.dto");
const list_files_dto_1 = require("./dto/list-files.dto");
const common_2 = require("@nestjs/common");
let FileController = FileController_1 = class FileController {
    constructor(fileService) {
        this.fileService = fileService;
        this.logger = new common_2.Logger(FileController_1.name);
    }
    getWorkspaceId(req, queryWorkspaceId) {
        var _a, _b;
        let workspaceId = req.headers['x-force-workspace-id'];
        if (!workspaceId && queryWorkspaceId) {
            workspaceId = queryWorkspaceId;
        }
        if (!workspaceId && req.headers['x-workspace-id']) {
            workspaceId = req.headers['x-workspace-id'];
        }
        if (!workspaceId && ((_a = req.body) === null || _a === void 0 ? void 0 : _a.workspaceId)) {
            workspaceId = req.body.workspaceId;
        }
        if (!workspaceId && ((_b = req.user) === null || _b === void 0 ? void 0 : _b.workspaceId)) {
            workspaceId = req.user.workspaceId;
        }
        return workspaceId;
    }
    sanitizeUserId(userId) {
        if (!userId)
            return null;
        if (Array.isArray(userId)) {
            this.logger.warn(`Received userId as array: ${userId}, using first value`);
            return userId[0];
        }
        if (typeof userId === 'string' && userId.includes(',')) {
            this.logger.warn(`Received comma-separated userId: ${userId}, using first value`);
            return userId.split(',')[0];
        }
        return userId;
    }
    async uploadFile(file, bodyUserId, bodyWorkspaceId, queryWorkspaceId, headerWorkspaceId, forceWorkspaceId) {
        const userId = this.sanitizeUserId(bodyUserId);
        this.logger.log(`File upload request received from user: ${userId}`);
        this.logger.log(`Workspace IDs from various sources:`);
        this.logger.log(`- Query param 'workspaceId': ${queryWorkspaceId || 'not provided'}`);
        this.logger.log(`- Body param 'workspaceId': ${bodyWorkspaceId || 'not provided'}`);
        this.logger.log(`- Header 'x-workspace-id': ${headerWorkspaceId || 'not provided'}`);
        this.logger.log(`- Header 'x-force-workspace-id': ${forceWorkspaceId || 'not provided'}`);
        const cleanBodyWorkspaceId = (bodyWorkspaceId === null || bodyWorkspaceId === void 0 ? void 0 : bodyWorkspaceId.includes(',')) ? bodyWorkspaceId.split(',')[0] : bodyWorkspaceId;
        const workspaceId = forceWorkspaceId || queryWorkspaceId || cleanBodyWorkspaceId || headerWorkspaceId;
        if (!workspaceId) {
            this.logger.error('No workspace ID provided in request');
            throw new common_1.BadRequestException('Workspace ID is required');
        }
        if (!userId) {
            this.logger.error('No user ID provided in request');
            throw new common_1.BadRequestException('User ID is required');
        }
        if (!file) {
            this.logger.error('No file uploaded');
            throw new common_1.BadRequestException('No file uploaded');
        }
        this.logger.log(`Using workspace ID: ${workspaceId} for file upload`);
        this.logger.log(`Using user ID: ${userId} for file upload`);
        this.logger.log(`File details: name=${file.originalname}, size=${file.size}, type=${file.mimetype}`);
        return this.fileService.uploadAndCreateFileMetadata(workspaceId, userId, file);
    }
    async listFiles(req, page, pageSize, queryWorkspaceId) {
        this.logger.log(`List files request received. Query params - workspaceId: ${queryWorkspaceId}`);
        const workspaceId = this.getWorkspaceId(req, queryWorkspaceId);
        if (!workspaceId) {
            throw new common_1.BadRequestException('Workspace ID is required');
        }
        this.logger.log(`Listing files for workspaceId: ${workspaceId}`);
        return this.fileService.findFilesByWorkspace(workspaceId, {
            page: page ? parseInt(page, 10) : undefined,
            pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
        });
    }
    async getFileById(fileId, req, queryWorkspaceId, queryUserId) {
        var _a;
        this.logger.log(`Get file request received for fileId: ${fileId}. Query params - workspaceId: ${queryWorkspaceId}, userId: ${queryUserId}`);
        const workspaceId = this.getWorkspaceId(req, queryWorkspaceId);
        const userId = this.sanitizeUserId(queryUserId || ((_a = req.user) === null || _a === void 0 ? void 0 : _a.userId));
        if (userId) {
            this.logger.log(`Request from user: ${userId}`);
        }
        if (!workspaceId) {
            throw new common_1.BadRequestException('Workspace ID is required');
        }
        this.logger.log(`Getting file details for fileId: ${fileId}, workspaceId: ${workspaceId}`);
        return this.fileService.findFileById(fileId, workspaceId);
    }
    async getDownloadUrl(fileId, req, queryWorkspaceId, queryUserId) {
        var _a;
        this.logger.log(`Get download URL request received for fileId: ${fileId}. Query params - workspaceId: ${queryWorkspaceId}, userId: ${queryUserId}`);
        const workspaceId = this.getWorkspaceId(req, queryWorkspaceId);
        const userId = this.sanitizeUserId(queryUserId || ((_a = req.user) === null || _a === void 0 ? void 0 : _a.userId));
        if (userId) {
            this.logger.log(`Download URL request from user: ${userId}`);
        }
        if (!workspaceId) {
            throw new common_1.BadRequestException('Workspace ID is required');
        }
        this.logger.log(`Getting download URL for fileId: ${fileId}, workspaceId: ${workspaceId}`);
        const url = await this.fileService.getDownloadUrl(fileId, workspaceId);
        return { downloadUrl: url };
    }
    async deleteFile(fileId, req, queryWorkspaceId, queryUserId, headerUserId) {
        var _a, _b, _c;
        this.logger.log(`Delete file request received for fileId: ${fileId}`);
        this.logger.log(`Query params - workspaceId: ${queryWorkspaceId}, userId: ${queryUserId}`);
        this.logger.log(`Headers - x-user-id: ${headerUserId || 'not provided'}`);
        const workspaceId = this.getWorkspaceId(req, queryWorkspaceId);
        let userId = this.sanitizeUserId(queryUserId);
        if (!userId && headerUserId) {
            userId = this.sanitizeUserId(headerUserId);
        }
        if (!userId && req.headers['x-user-id']) {
            userId = this.sanitizeUserId(req.headers['x-user-id']);
        }
        if (!userId && ((_a = req.user) === null || _a === void 0 ? void 0 : _a.userId)) {
            userId = this.sanitizeUserId(req.user.userId);
        }
        if (!workspaceId) {
            this.logger.error('No workspace ID provided for file deletion');
            throw new common_1.BadRequestException('Workspace ID is required');
        }
        if (!userId) {
            this.logger.error('No user ID provided for file deletion');
            throw new common_1.BadRequestException('User ID is required for file deletion');
        }
        const isAdmin = ((_b = req.user) === null || _b === void 0 ? void 0 : _b.workspaceRole) === 'admin' || ((_c = req.user) === null || _c === void 0 ? void 0 : _c.workspaceRole) === 'owner';
        this.logger.log(`Deleting file: ${fileId} for workspaceId: ${workspaceId}, userId: ${userId}, isAdmin: ${isAdmin}`);
        await this.fileService.deleteFile(fileId, workspaceId, userId, isAdmin);
    }
};
exports.FileController = FileController;
tslib_1.__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Upload a file' }),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.CREATED,
        description: 'File uploaded successfully',
        type: file_response_dto_1.FileResponseDto,
    }),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        limits: {
            fileSize: 25 * 1024 * 1024,
        },
    })),
    tslib_1.__param(0, (0, common_1.UploadedFile)()),
    tslib_1.__param(1, (0, common_1.Body)('userId')),
    tslib_1.__param(2, (0, common_1.Body)('workspaceId')),
    tslib_1.__param(3, (0, common_1.Query)('workspaceId')),
    tslib_1.__param(4, (0, common_1.Headers)('x-workspace-id')),
    tslib_1.__param(5, (0, common_1.Headers)('x-force-workspace-id')),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [Object, String, String, String, String, String]),
    tslib_1.__metadata("design:returntype", Promise)
], FileController.prototype, "uploadFile", null);
tslib_1.__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'List files for workspace' }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.OK,
        description: 'Files retrieved successfully',
        type: list_files_dto_1.ListFilesDto,
    }),
    tslib_1.__param(0, (0, common_1.Req)()),
    tslib_1.__param(1, (0, common_1.Query)('page')),
    tslib_1.__param(2, (0, common_1.Query)('pageSize')),
    tslib_1.__param(3, (0, common_1.Query)('workspaceId')),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [Object, String, String, String]),
    tslib_1.__metadata("design:returntype", Promise)
], FileController.prototype, "listFiles", null);
tslib_1.__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get file metadata by ID' }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.OK,
        description: 'File metadata retrieved successfully',
        type: file_response_dto_1.FileResponseDto,
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.NOT_FOUND,
        description: 'File not found',
    }),
    tslib_1.__param(0, (0, common_1.Param)('id')),
    tslib_1.__param(1, (0, common_1.Req)()),
    tslib_1.__param(2, (0, common_1.Query)('workspaceId')),
    tslib_1.__param(3, (0, common_1.Query)('userId')),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String, Object, String, String]),
    tslib_1.__metadata("design:returntype", Promise)
], FileController.prototype, "getFileById", null);
tslib_1.__decorate([
    (0, common_1.Get)(':id/download'),
    (0, swagger_1.ApiOperation)({ summary: 'Get download URL for a file' }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.OK,
        description: 'Download URL generated successfully',
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.NOT_FOUND,
        description: 'File not found',
    }),
    tslib_1.__param(0, (0, common_1.Param)('id')),
    tslib_1.__param(1, (0, common_1.Req)()),
    tslib_1.__param(2, (0, common_1.Query)('workspaceId')),
    tslib_1.__param(3, (0, common_1.Query)('userId')),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String, Object, String, String]),
    tslib_1.__metadata("design:returntype", Promise)
], FileController.prototype, "getDownloadUrl", null);
tslib_1.__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Delete a file' }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.OK,
        description: 'File deleted successfully',
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.NOT_FOUND,
        description: 'File not found',
    }),
    tslib_1.__param(0, (0, common_1.Param)('id')),
    tslib_1.__param(1, (0, common_1.Req)()),
    tslib_1.__param(2, (0, common_1.Query)('workspaceId')),
    tslib_1.__param(3, (0, common_1.Query)('userId')),
    tslib_1.__param(4, (0, common_1.Headers)('x-user-id')),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String, Object, String, String, String]),
    tslib_1.__metadata("design:returntype", Promise)
], FileController.prototype, "deleteFile", null);
exports.FileController = FileController = FileController_1 = tslib_1.__decorate([
    (0, swagger_1.ApiTags)('Files'),
    (0, common_1.Controller)('files'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    tslib_1.__metadata("design:paramtypes", [file_service_1.FileService])
], FileController);
//# sourceMappingURL=file.controller.js.map