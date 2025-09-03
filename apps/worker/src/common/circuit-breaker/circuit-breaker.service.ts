import { Injectable, Logger } from '@nestjs/common';

/**
 * Circuit breaker states
 */
enum CircuitState {
  CLOSED, // Normal operation, requests pass through
  OPEN, // Circuit is open, requests fail fast
  HALF_OPEN, // Testing if the service is back to normal
}

/**
 * Circuit breaker options
 */
export interface CircuitBreakerOptions {
  /** Failure threshold before opening the circuit */
  failureThreshold?: number;
  /** Success threshold in half-open state before closing the circuit */
  successThreshold?: number;
  /** Timeout in milliseconds before transitioning from open to half-open */
  resetTimeout?: number;
}

/**
 * Circuit breaker implementation to prevent cascading failures
 */
@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private circuits: Map<string, CircuitBreaker> = new Map();

  /**
   * Get or create a circuit breaker for a specific service
   * @param serviceName Name of the service
   * @param options Circuit breaker options
   */
  getCircuitBreaker(serviceName: string, options?: CircuitBreakerOptions): CircuitBreaker {
    if (!this.circuits.has(serviceName)) {
      this.circuits.set(serviceName, new CircuitBreaker(serviceName, options));
    }
    return this.circuits.get(serviceName);
  }

  /**
   * Execute a function with circuit breaker protection
   * @param serviceName Name of the service
   * @param fn Function to execute
   * @param options Circuit breaker options
   */
  async executeWithCircuitBreaker<T>(
    serviceName: string,
    fn: () => Promise<T>,
    options?: CircuitBreakerOptions,
  ): Promise<T> {
    const circuitBreaker = this.getCircuitBreaker(serviceName, options);
    return circuitBreaker.execute(fn);
  }
}

/**
 * Circuit breaker implementation for a specific service
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number = 0;
  private readonly logger: Logger;

  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly resetTimeout: number;

  constructor(
    private readonly serviceName: string,
    options?: CircuitBreakerOptions,
  ) {
    this.failureThreshold = options?.failureThreshold || 5;
    this.successThreshold = options?.successThreshold || 2;
    this.resetTimeout = options?.resetTimeout || 30000; // 30 seconds
    this.logger = new Logger(`CircuitBreaker:${serviceName}`);
    this.logger.log(`Circuit breaker initialized with failureThreshold=${this.failureThreshold}, successThreshold=${this.successThreshold}, resetTimeout=${this.resetTimeout}ms`);
  }

  /**
   * Execute a function with circuit breaker protection
   * @param fn Function to execute
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.logger.log(`Transitioning to HALF_OPEN state for ${this.serviceName}`);
        this.state = CircuitState.HALF_OPEN;
      } else {
        this.logger.warn(`Circuit is OPEN for ${this.serviceName}, failing fast`);
        throw new Error(`Circuit breaker is open for service: ${this.serviceName}`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.logger.log(`Success threshold reached, closing circuit for ${this.serviceName}`);
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failure count on success in closed state
      this.failureCount = Math.max(0, this.failureCount - 1);
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(error: Error): void {
    this.lastFailureTime = Date.now();
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.logger.warn(`Failed in HALF_OPEN state, opening circuit for ${this.serviceName}: ${error.message}`);
      this.state = CircuitState.OPEN;
      this.successCount = 0;
    } else if (this.state === CircuitState.CLOSED) {
      this.failureCount++;
      if (this.failureCount >= this.failureThreshold) {
        this.logger.warn(`Failure threshold reached, opening circuit for ${this.serviceName}`);
        this.state = CircuitState.OPEN;
      }
    }
  }

  /**
   * Check if we should attempt to reset the circuit
   */
  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailureTime > this.resetTimeout;
  }

  /**
   * Get the current state of the circuit
   */
  getState(): string {
    return CircuitState[this.state];
  }

  /**
   * Reset the circuit breaker to closed state
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.logger.log(`Circuit reset to CLOSED for ${this.serviceName}`);
  }
}
