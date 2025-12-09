"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListFilesDto = void 0;
const tslib_1 = require("tslib");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const file_response_dto_1 = require("./file-response.dto");
class ListFilesDto {
}
exports.ListFilesDto = ListFilesDto;
tslib_1.__decorate([
    (0, class_transformer_1.Expose)(),
    (0, class_transformer_1.Type)(() => file_response_dto_1.FileResponseDto),
    tslib_1.__metadata("design:type", Array)
], ListFilesDto.prototype, "data", void 0);
tslib_1.__decorate([
    (0, class_transformer_1.Expose)(),
    (0, class_validator_1.IsInt)(),
    tslib_1.__metadata("design:type", Number)
], ListFilesDto.prototype, "total", void 0);
tslib_1.__decorate([
    (0, class_transformer_1.Expose)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsOptional)(),
    tslib_1.__metadata("design:type", Number)
], ListFilesDto.prototype, "page", void 0);
tslib_1.__decorate([
    (0, class_transformer_1.Expose)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsOptional)(),
    tslib_1.__metadata("design:type", Number)
], ListFilesDto.prototype, "pageSize", void 0);
//# sourceMappingURL=list-files.dto.js.map