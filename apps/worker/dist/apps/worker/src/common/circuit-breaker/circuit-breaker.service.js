"use strict";
var CircuitBreakerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitBreaker = exports.CircuitBreakerService = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
var CircuitState;
(function (CircuitState) {
    CircuitState[CircuitState["CLOSED"] = 0] = "CLOSED";
    CircuitState[CircuitState["OPEN"] = 1] = "OPEN";
    CircuitState[CircuitState["HALF_OPEN"] = 2] = "HALF_OPEN";
})(CircuitState || (CircuitState = {}));
let CircuitBreakerService = CircuitBreakerService_1 = class CircuitBreakerService {
    constructor() {
        this.logger = new common_1.Logger(CircuitBreakerService_1.name);
        this.circuits = new Map();
    }
    getCircuitBreaker(serviceName, options) {
        if (!this.circuits.has(serviceName)) {
            this.circuits.set(serviceName, new CircuitBreaker(serviceName, options));
        }
        return this.circuits.get(serviceName);
    }
    async executeWithCircuitBreaker(serviceName, fn, options) {
        const circuitBreaker = this.getCircuitBreaker(serviceName, options);
        return circuitBreaker.execute(fn);
    }
};
exports.CircuitBreakerService = CircuitBreakerService;
exports.CircuitBreakerService = CircuitBreakerService = CircuitBreakerService_1 = tslib_1.__decorate([
    (0, common_1.Injectable)()
], CircuitBreakerService);
class CircuitBreaker {
    constructor(serviceName, options) {
        this.serviceName = serviceName;
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = 0;
        this.failureThreshold = (options === null || options === void 0 ? void 0 : options.failureThreshold) || 5;
        this.successThreshold = (options === null || options === void 0 ? void 0 : options.successThreshold) || 2;
        this.resetTimeout = (options === null || options === void 0 ? void 0 : options.resetTimeout) || 30000;
        this.logger = new common_1.Logger(`CircuitBreaker:${serviceName}`);
        this.logger.log(`Circuit breaker initialized with failureThreshold=${this.failureThreshold}, successThreshold=${this.successThreshold}, resetTimeout=${this.resetTimeout}ms`);
    }
    async execute(fn) {
        if (this.state === CircuitState.OPEN) {
            if (this.shouldAttemptReset()) {
                this.logger.log(`Transitioning to HALF_OPEN state for ${this.serviceName}`);
                this.state = CircuitState.HALF_OPEN;
            }
            else {
                this.logger.warn(`Circuit is OPEN for ${this.serviceName}, failing fast`);
                throw new Error(`Circuit breaker is open for service: ${this.serviceName}`);
            }
        }
        try {
            const result = await fn();
            this.onSuccess();
            return result;
        }
        catch (error) {
            this.onFailure(error);
            throw error;
        }
    }
    onSuccess() {
        if (this.state === CircuitState.HALF_OPEN) {
            this.successCount++;
            if (this.successCount >= this.successThreshold) {
                this.logger.log(`Success threshold reached, closing circuit for ${this.serviceName}`);
                this.state = CircuitState.CLOSED;
                this.failureCount = 0;
                this.successCount = 0;
            }
        }
        else if (this.state === CircuitState.CLOSED) {
            this.failureCount = Math.max(0, this.failureCount - 1);
        }
    }
    onFailure(error) {
        this.lastFailureTime = Date.now();
        if (this.state === CircuitState.HALF_OPEN) {
            this.logger.warn(`Failed in HALF_OPEN state, opening circuit for ${this.serviceName}: ${error.message}`);
            this.state = CircuitState.OPEN;
            this.successCount = 0;
        }
        else if (this.state === CircuitState.CLOSED) {
            this.failureCount++;
            if (this.failureCount >= this.failureThreshold) {
                this.logger.warn(`Failure threshold reached, opening circuit for ${this.serviceName}`);
                this.state = CircuitState.OPEN;
            }
        }
    }
    shouldAttemptReset() {
        return Date.now() - this.lastFailureTime > this.resetTimeout;
    }
    getState() {
        return CircuitState[this.state];
    }
    reset() {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.logger.log(`Circuit reset to CLOSED for ${this.serviceName}`);
    }
}
exports.CircuitBreaker = CircuitBreaker;
//# sourceMappingURL=circuit-breaker.service.js.map