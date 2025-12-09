"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommonModule = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const bull_1 = require("@nestjs/bull");
const queue_definitions_1 = require("@jibu/queue-definitions");
const circuit_breaker_service_1 = require("./circuit-breaker/circuit-breaker.service");
const dead_letter_service_1 = require("./dead-letter/dead-letter.service");
let CommonModule = class CommonModule {
};
exports.CommonModule = CommonModule;
exports.CommonModule = CommonModule = tslib_1.__decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule,
            bull_1.BullModule.registerQueue({
                name: queue_definitions_1.QUEUE_NAMES.WORKFLOW_EXECUTION,
            }),
        ],
        providers: [circuit_breaker_service_1.CircuitBreakerService, dead_letter_service_1.DeadLetterService],
        exports: [circuit_breaker_service_1.CircuitBreakerService, dead_letter_service_1.DeadLetterService],
    })
], CommonModule);
//# sourceMappingURL=common.module.js.map