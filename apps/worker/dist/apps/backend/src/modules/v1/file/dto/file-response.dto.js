"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileResponseDto = exports.UserInfoDto = void 0;
const tslib_1 = require("tslib");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class UserInfoDto {
}
exports.UserInfoDto = UserInfoDto;
tslib_1.__decorate([
    (0, class_transformer_1.Expose)(),
    (0, class_validator_1.IsString)(),
    tslib_1.__metadata("design:type", String)
], UserInfoDto.prototype, "id", void 0);
tslib_1.__decorate([
    (0, class_transformer_1.Expose)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    tslib_1.__metadata("design:type", String)
], UserInfoDto.prototype, "firstName", void 0);
tslib_1.__decorate([
    (0, class_transformer_1.Expose)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    tslib_1.__metadata("design:type", String)
], UserInfoDto.prototype, "lastName", void 0);
tslib_1.__decorate([
    (0, class_transformer_1.Expose)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    tslib_1.__metadata("design:type", String)
], UserInfoDto.prototype, "email", void 0);
class FileResponseDto {
}
exports.FileResponseDto = FileResponseDto;
tslib_1.__decorate([
    (0, class_transformer_1.Expose)(),
    (0, class_validator_1.IsString)(),
    tslib_1.__metadata("design:type", String)
], FileResponseDto.prototype, "id", void 0);
tslib_1.__decorate([
    (0, class_transformer_1.Expose)(),
    (0, class_validator_1.IsString)(),
    tslib_1.__metadata("design:type", String)
], FileResponseDto.prototype, "name", void 0);
tslib_1.__decorate([
    (0, class_transformer_1.Expose)(),
    (0, class_validator_1.IsString)(),
    tslib_1.__metadata("design:type", String)
], FileResponseDto.prototype, "mimeType", void 0);
tslib_1.__decorate([
    (0, class_transformer_1.Expose)(),
    (0, class_validator_1.IsInt)(),
    tslib_1.__metadata("design:type", Number)
], FileResponseDto.prototype, "sizeBytes", void 0);
tslib_1.__decorate([
    (0, class_transformer_1.Expose)(),
    (0, class_validator_1.IsString)(),
    tslib_1.__metadata("design:type", String)
], FileResponseDto.prototype, "organizationId", void 0);
tslib_1.__decorate([
    (0, class_transformer_1.Expose)(),
    (0, class_validator_1.IsString)(),
    tslib_1.__metadata("design:type", String)
], FileResponseDto.prototype, "userId", void 0);
tslib_1.__decorate([
    (0, class_transformer_1.Expose)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => UserInfoDto),
    (0, class_validator_1.IsOptional)(),
    tslib_1.__metadata("design:type", UserInfoDto)
], FileResponseDto.prototype, "uploader", void 0);
tslib_1.__decorate([
    (0, class_transformer_1.Expose)(),
    (0, class_validator_1.IsDate)(),
    tslib_1.__metadata("design:type", Date)
], FileResponseDto.prototype, "createdAt", void 0);
tslib_1.__decorate([
    (0, class_transformer_1.Exclude)(),
    tslib_1.__metadata("design:type", String)
], FileResponseDto.prototype, "storageProvider", void 0);
tslib_1.__decorate([
    (0, class_transformer_1.Exclude)(),
    tslib_1.__metadata("design:type", String)
], FileResponseDto.prototype, "storageKey", void 0);
tslib_1.__decorate([
    (0, class_transformer_1.Exclude)(),
    tslib_1.__metadata("design:type", Date)
], FileResponseDto.prototype, "updatedAt", void 0);
//# sourceMappingURL=file-response.dto.js.map