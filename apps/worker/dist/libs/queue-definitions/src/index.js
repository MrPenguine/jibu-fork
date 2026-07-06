"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookPriority = exports.JOB_NAMES = exports.QUEUE_NAMES = void 0;
const tslib_1 = require("tslib");
tslib_1.__exportStar(require("./webhook-payload"), exports);
exports.QUEUE_NAMES = {
    DEFAULT: 'default',
    INDEXING: 'indexing',
    WORKFLOW_EXECUTION: 'workflow-execution',
    WORKFLOW_PUBLISH: 'workflow-publish',
    WEBHOOK_DELIVERY: 'webhook-delivery',
};
exports.JOB_NAMES = {
    DEFAULT_JOB: 'default-job',
    EMAIL_JOB: 'email-job',
    INDEX_FILE_SOURCE: 'index-file-source',
    DEINDEX_SOURCE: 'deindex-source',
    REEMBED_CHUNK: 'reembed-chunk',
    EXECUTE_WORKFLOW: 'execute-workflow',
    CANCEL_WORKFLOW: 'cancel-workflow',
    CHECK_WORKFLOW_STATUS: 'check-workflow-status',
    PUBLISH_WORKFLOW: 'publish-workflow',
    DELIVER_WEBHOOK: 'deliver-webhook',
};
var WebhookPriority;
(function (WebhookPriority) {
    WebhookPriority[WebhookPriority["VOICE_EVENTS"] = 10] = "VOICE_EVENTS";
    WebhookPriority[WebhookPriority["VOICE_MESSAGES"] = 5] = "VOICE_MESSAGES";
    WebhookPriority[WebhookPriority["CHAT_MESSAGES"] = 1] = "CHAT_MESSAGES";
})(WebhookPriority || (exports.WebhookPriority = WebhookPriority = {}));
//# sourceMappingURL=index.js.map