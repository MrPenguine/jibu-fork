"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaService = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
let PrismaService = class PrismaService extends client_1.PrismaClient {
    constructor() {
        super();
        Object.defineProperty(this, 'Tool', {
            get: function () {
                return this.tool;
            }
        });
        Object.defineProperty(this, 'Credential', {
            get: function () {
                return this.credential;
            }
        });
        Object.defineProperty(this, 'Folder', {
            get: function () {
                return this.folder;
            }
        });
        Object.defineProperty(this, 'Webhook', {
            get: function () {
                return this.webhook;
            }
        });
        Object.defineProperty(this, 'WebhookInvocation', {
            get: function () {
                return this.webhookInvocation;
            }
        });
    }
    async onModuleInit() {
        await this.$connect();
    }
    async onModuleDestroy() {
        await this.$disconnect();
    }
};
exports.PrismaService = PrismaService;
exports.PrismaService = PrismaService = tslib_1.__decorate([
    (0, common_1.Injectable)(),
    tslib_1.__metadata("design:paramtypes", [])
], PrismaService);
//# sourceMappingURL=prisma.service.js.map