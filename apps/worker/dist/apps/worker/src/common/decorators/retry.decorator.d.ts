export interface RetryOptions {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffFactor?: number;
    retryableErrors?: any[];
    logRetries?: boolean;
}
export declare function Retry(options?: RetryOptions): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
