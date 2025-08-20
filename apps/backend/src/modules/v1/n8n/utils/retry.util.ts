/**
 * Utility for retrying failed operations
 */
import { Logger } from '@nestjs/common';

export interface RetryOptions {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
  retryableErrors?: (error: any) => boolean;
}

const defaultRetryOptions: RetryOptions = {
  maxRetries: 3,
  initialDelay: 300,
  maxDelay: 3000,
  backoffFactor: 2,
  retryableErrors: (error: any) => {
    // By default, retry on network errors and 5xx server errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
      return true;
    }
    
    if (error.response && error.response.status >= 500 && error.response.status < 600) {
      return true;
    }
    
    return false;
  }
};

/**
 * Executes a function with retry logic
 * 
 * @param fn Function to execute
 * @param logger Logger instance
 * @param options Retry options
 * @returns Result of the function
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  logger: Logger,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const retryOptions = { ...defaultRetryOptions, ...options };
  let lastError: any;
  
  for (let attempt = 1; attempt <= retryOptions.maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      const isRetryable = retryOptions.retryableErrors(error);
      const hasAttemptsLeft = attempt <= retryOptions.maxRetries;
      
      if (isRetryable && hasAttemptsLeft) {
        const delay = Math.min(
          retryOptions.initialDelay * Math.pow(retryOptions.backoffFactor, attempt - 1),
          retryOptions.maxDelay
        );
        
        logger.warn(
          `Attempt ${attempt}/${retryOptions.maxRetries + 1} failed. Retrying in ${delay}ms. Error: ${error.message}`
        );
        
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        if (!isRetryable) {
          logger.error(`Non-retryable error: ${error.message}`);
        } else {
          logger.error(`All ${retryOptions.maxRetries + 1} attempts failed. Last error: ${error.message}`);
        }
        throw error;
      }
    }
  }
  
  // This should never happen due to the throw in the catch block
  throw lastError;
}
