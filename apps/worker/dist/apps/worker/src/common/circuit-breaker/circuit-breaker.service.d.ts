export interface CircuitBreakerOptions {
    failureThreshold?: number;
    successThreshold?: number;
    resetTimeout?: number;
}
export declare class CircuitBreakerService {
    private readonly logger;
    private circuits;
    getCircuitBreaker(serviceName: string, options?: CircuitBreakerOptions): CircuitBreaker;
    executeWithCircuitBreaker<T>(serviceName: string, fn: () => Promise<T>, options?: CircuitBreakerOptions): Promise<T>;
}
export declare class CircuitBreaker {
    private readonly serviceName;
    private state;
    private failureCount;
    private successCount;
    private lastFailureTime;
    private readonly logger;
    private readonly failureThreshold;
    private readonly successThreshold;
    private readonly resetTimeout;
    constructor(serviceName: string, options?: CircuitBreakerOptions);
    execute<T>(fn: () => Promise<T>): Promise<T>;
    private onSuccess;
    private onFailure;
    private shouldAttemptReset;
    getState(): string;
    reset(): void;
}
