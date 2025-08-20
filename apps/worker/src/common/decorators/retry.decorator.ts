import { Logger } from '@nestjs/common';

/**
 * Options for the retry decorator
 */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxAttempts?: number;
  /** Initial delay in milliseconds */
  initialDelay?: number;
  /** Maximum delay in milliseconds */
  maxDelay?: number;
  /** Factor to multiply delay by after each attempt */
  backoffFactor?: number;
  /** List of error types to retry on */
  retryableErrors?: any[];
  /** Whether to log retry attempts */
  logRetries?: boolean;
}

/**
 * Decorator that retries a method if it throws an error
 * Uses exponential backoff with jitter
 */
export function Retry(options: RetryOptions = {}) {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffFactor = 2,
    retryableErrors = [Error],
    logRetries = true,
  } = options;

  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    const logger = new Logger(`${target.constructor.name}.${propertyKey}`);

    descriptor.value = async function (...args: any[]) {
      let attempt = 1;
      let delay = initialDelay;

      while (attempt <= maxAttempts) {
        try {
          return await originalMethod.apply(this, args);
        } catch (error) {
          // Check if we should retry this error type
          const shouldRetry = retryableErrors.some(
            (errorType) => error instanceof errorType,
          );

          if (!shouldRetry || attempt >= maxAttempts) {
            // Don't retry if error is not retryable or we've reached max attempts
            throw error;
          }

          if (logRetries) {
            logger.warn(
              `Attempt ${attempt} failed, retrying in ${delay}ms: ${error.message}`,
            );
          }

          // Wait for the delay period
          await new Promise((resolve) => setTimeout(resolve, delay));

          // Calculate next delay with exponential backoff and jitter
          delay = Math.min(
            delay * backoffFactor * (0.8 + Math.random() * 0.4), // Add 20% jitter
            maxDelay,
          );

          attempt++;
        }
      }
    };

    return descriptor;
  };
}
