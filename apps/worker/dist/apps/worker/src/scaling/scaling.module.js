"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScalingModule = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const schedule_1 = require("@nestjs/schedule");
const bull_1 = require("@nestjs/bull");
const queue_definitions_1 = require("@jibu/queue-definitions");
const scaling_service_1 = require("./scaling.service");
const n8n_module_1 = require("../n8n/n8n.module");
let ScalingModule = class ScalingModule {
};
exports.ScalingModule = ScalingModule;
exports.ScalingModule = ScalingModule = tslib_1.__decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule,
            schedule_1.ScheduleModule.forRoot(),
            bull_1.BullModule.registerQueue({
                name: queue_definitions_1.QUEUE_NAMES.WORKFLOW_EXECUTION,
            }, {
                name: queue_definitions_1.QUEUE_NAMES.WEBHOOK_DELIVERY,
            }),
            n8n_module_1.N8nModule,
        ],
        providers: [scaling_service_1.ScalingService],
        exports: [scaling_service_1.ScalingService],
    })
], ScalingModule);
//# sourceMappingURL=scaling.module.js.map