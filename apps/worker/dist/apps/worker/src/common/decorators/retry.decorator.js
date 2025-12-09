"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Retry = Retry;
const common_1 = require("@nestjs/common");
function Retry(options = {}) {
    const { maxAttempts = 3, initialDelay = 1000, maxDelay = 30000, backoffFactor = 2, retryableErrors = [Error], logRetries = true, } = options;
    return function (target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        const logger = new common_1.Logger(`${target.constructor.name}.${propertyKey}`);
        descriptor.value = async function (...args) {
            let attempt = 1;
            let delay = initialDelay;
            while (attempt <= maxAttempts) {
                try {
                    return await originalMethod.apply(this, args);
                }
                catch (error) {
                    const shouldRetry = retryableErrors.some((errorType) => error instanceof errorType);
                    if (!shouldRetry || attempt >= maxAttempts) {
                        throw error;
                    }
                    if (logRetries) {
                        logger.warn(`Attempt ${attempt} failed, retrying in ${delay}ms: ${error.message}`);
                    }
                    await new Promise((resolve) => setTimeout(resolve, delay));
                    delay = Math.min(delay * backoffFactor * (0.8 + Math.random() * 0.4), maxDelay);
                    attempt++;
                }
            }
        };
        return descriptor;
    };
}
//# sourceMappingURL=retry.decorator.js.map