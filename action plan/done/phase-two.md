# Phase Two: Worker Implementation

## 1. Introduction

This document outlines the implementation plan for Phase Two of the Jibu Console project, focusing on worker implementation for handling workflow execution using n8n. The worker system will enable scalable, resilient processing of workflows created in the workflow editor.

### Objectives
- Implement a scalable worker system using n8n
- Integrate with existing workflow functionality
- Ensure resilience and error handling
- Provide monitoring and observability

## 2. n8n Worker Architecture

### A. n8n Worker Configuration

```yaml
# docker-compose.yml for n8n workers
version: '3.8'

services:
  n8n-redis:
    image: redis:alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

  n8n-worker:
    image: n8nio/n8n
    environment:
      - N8N_HOST=n8n-worker
      - N8N_PORT=5678
      - N8N_PROTOCOL=http
      - N8N_USER_FOLDER=/home/node/.n8n
      - EXECUTIONS_MODE=queue
      - QUEUE_BULL_REDIS_HOST=n8n-redis
      - QUEUE_BULL_REDIS_PORT=6379
      - QUEUE_BULL_BLOCKING_TIMEOUT=5000
      - N8N_API_ENABLED=true
      - N8N_API_KEY=${N8N_API_KEY}
    depends_on:
      - n8n-redis
    deploy:
      replicas: 5  # Adjust based on load
    ports:
      - "5678:5678"

volumes:
  redis-data:
```

### B. Communication Patterns

The worker system will use the following communication patterns:

1. **API-based Communication**: The backend will communicate with n8n workers via REST API
2. **Queue-based Processing**: Tasks will be queued in Redis for processing by available workers
3. **Webhook Callbacks**: Workers will report task completion via webhooks back to the backend

### C. Queue Management

The system will use Bull queue with Redis for managing task distribution:

```typescript
// apps/worker/src/queue/queue.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bull';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private workflowQueue: Queue;
  
  constructor(private readonly configService: ConfigService) {
    // Initialize Bull queue with Redis connection
    this.workflowQueue = new Queue('workflow-execution', {
      redis: {
        host: this.configService.get('REDIS_HOST'),
        port: this.configService.get('REDIS_PORT'),
      }
    });
  }
  
  async addWorkflowToQueue(workflowData: any) {
    return this.workflowQueue.add('execute-workflow', workflowData, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });
  }
}
```

## 3. Worker Implementation

### A. Worker Scaling Strategy

```typescript
// apps/worker/src/scaling/scaling.worker.ts
import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class ScalingWorker {
  private readonly logger = new Logger(ScalingWorker.name);
  private readonly QUEUE_THRESHOLD = 100; // Scale up when queue exceeds this
  private readonly MIN_WORKERS = 3;
  private readonly MAX_WORKERS = 20;
  private currentWorkers = 5;

  constructor(private readonly redisService: RedisService) {}

  async monitorQueue() {
    try {
      // In a real implementation, you'd query Redis directly for queue length
      const queueLength = await this.getQueueLength();
      
      if (queueLength > this.QUEUE_THRESHOLD && this.currentWorkers < this.MAX_WORKERS) {
        this.scaleUp();
      } else if (queueLength < this.QUEUE_THRESHOLD / 2 && this.currentWorkers > this.MIN_WORKERS) {
        this.scaleDown();
      }
    } catch (error) {
      this.logger.error('Error monitoring queue', error);
    }
  }

  private async getQueueLength(): Promise<number> {
    // In a real implementation, you'd query the Redis queue directly
    // This is a simplified example
    return parseInt(await this.redisService.get('n8n:queue:length')) || 0;
  }

  private scaleUp() {
    this.currentWorkers++;
    this.logger.log(`Scaling up n8n workers to ${this.currentWorkers}`);
    // In a real implementation, you'd call your orchestration API (Kubernetes, Docker Swarm, etc.)
  }

  private scaleDown() {
    this.currentWorkers--;
    this.logger.log(`Scaling down n8n workers to ${this.currentWorkers}`);
    // In a real implementation, you'd call your orchestration API
  }
}
```

### B. Critical Worker Configuration

```typescript
// apps/worker/src/n8n/n8n.worker.config.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class N8nWorkerConfig {
  private readonly logger = new Logger(N8nWorkerConfig.name);

  constructor(private readonly configService: ConfigService) {}

  getWorkerConfig() {
    return {
      // Queue configuration
      queue: {
        redis: {
          host: this.configService.get('N8N_REDIS_HOST'),
          port: this.configService.get('N8N_REDIS_PORT'),
        },
        bull: {
          prefix: 'bull',
          settings: {
            lockDuration: 30000,
            maxStalledCount: 3,
            stallInterval: 5000,
          }
        }
      },
      
      // Worker pool configuration
      worker: {
        maxConcurrency: this.configService.get('N8N_WORKER_CONCURRENCY', 5),
        timeout: this.configService.get('N8N_WORKER_TIMEOUT', 30000),
        retryAttempts: this.configService.get('N8N_WORKER_RETRY', 2),
      },
      
      // Performance tuning
      performance: {
        binaryDataMode: 'default', // 'filesystem' for large payloads
        maxExecutionTimeout: this.configService.get('N8N_EXECUTION_TIMEOUT', 120),
        maxOldSpaceSize: this.configService.get('N8N_MEMORY_LIMIT', 512),
      }
    };
  }
}
```

### C. N8n Integration Service

```typescript
// apps/worker/src/n8n/n8n-integration.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class N8nIntegrationService {
  private readonly logger = new Logger(N8nIntegrationService.name);
  private readonly n8nApiUrl: string;
  private readonly n8nApiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.n8nApiUrl = this.configService.get('N8N_API_URL');
    this.n8nApiKey = this.configService.get('N8N_API_KEY');
  }

  async executeWorkflow(workflowId: string, executionData: any): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.n8nApiUrl}/workflows/${workflowId}/execute`,
          executionData,
          {
            headers: {
              'X-N8N-API-KEY': this.n8nApiKey,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Error executing workflow ${workflowId}:`, error);
      throw new Error(`Failed to execute workflow: ${error.message}`);
    }
  }

  async getWorkflowStatus(executionId: string): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.n8nApiUrl}/executions/${executionId}`,
          {
            headers: {
              'X-N8N-API-KEY': this.n8nApiKey,
            },
          },
        ),
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Error getting execution status ${executionId}:`, error);
      throw new Error(`Failed to get execution status: ${error.message}`);
    }
  }
}
```

## 4. Error Handling & Resilience

### A. Retry Mechanisms

```typescript
// apps/worker/src/common/retry.decorator.ts
import { Logger } from '@nestjs/common';

export function Retry(options: { maxRetries: number; delay: number }) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const logger = new Logger(`Retry:${target.constructor.name}`);

    descriptor.value = async function (...args: any[]) {
      let retries = 0;
      let lastError: Error;

      while (retries <= options.maxRetries) {
        try {
          return await originalMethod.apply(this, args);
        } catch (error) {
          lastError = error;
          retries++;
          
          if (retries <= options.maxRetries) {
            logger.warn(
              `Method ${propertyKey} failed, retrying (${retries}/${options.maxRetries})...`,
              error.message,
            );
            await new Promise(resolve => setTimeout(resolve, options.delay));
          }
        }
      }

      logger.error(
        `Method ${propertyKey} failed after ${options.maxRetries} retries`,
        lastError,
      );
      throw lastError;
    };

    return descriptor;
  };
}
```

### B. Circuit Breaker Pattern

```typescript
// apps/worker/src/common/circuit-breaker.service.ts
import { Injectable, Logger } from '@nestjs/common';

enum CircuitState {
  CLOSED,
  OPEN,
  HALF_OPEN,
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private state = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime: number;
  private readonly failureThreshold = 5;
  private readonly resetTimeout = 30000; // 30 seconds

  async executeWithCircuitBreaker<T>(command: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.logger.log('Circuit half-open, testing service availability');
        this.state = CircuitState.HALF_OPEN;
      } else {
        this.logger.warn('Circuit open, rejecting request');
        throw new Error('Service unavailable');
      }
    }

    try {
      const result = await command();
      
      if (this.state === CircuitState.HALF_OPEN) {
        this.logger.log('Service recovered, closing circuit');
        this.reset();
      }
      
      return result;
    } catch (error) {
      this.handleFailure();
      throw error;
    }
  }

  private handleFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (
      this.state === CircuitState.HALF_OPEN ||
      this.failureCount >= this.failureThreshold
    ) {
      this.state = CircuitState.OPEN;
      this.logger.warn(`Circuit opened after ${this.failureCount} failures`);
    }
  }

  private reset() {
    this.failureCount = 0;
    this.state = CircuitState.CLOSED;
  }
}
```

### C. Dead Letter Queue

```typescript
// apps/worker/src/queue/dead-letter.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DeadLetterService {
  private readonly logger = new Logger(DeadLetterService.name);
  private deadLetterQueue: Queue;

  constructor(private readonly configService: ConfigService) {
    this.deadLetterQueue = new Queue('dead-letter-queue', {
      redis: {
        host: this.configService.get('REDIS_HOST'),
        port: this.configService.get('REDIS_PORT'),
      },
    });

    // Process dead letter queue items (logging only)
    this.deadLetterQueue.process(async (job) => {
      this.logger.error(
        `Processing dead letter: ${job.id}`,
        {
          originalQueue: job.data.originalQueue,
          failReason: job.data.failReason,
          originalData: job.data.originalData,
        },
      );
      // In a real implementation, you might notify admins or store in database
    });
  }

  async addToDeadLetterQueue(data: any, originalQueue: string, failReason: string) {
    await this.deadLetterQueue.add({
      originalData: data,
      originalQueue,
      failReason,
      timestamp: new Date().toISOString(),
    });
  }
}
```

## 5. Monitoring & Observability

### A. Metrics Collection

```typescript
// apps/worker/src/monitoring/metrics.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { register, Counter, Gauge, Histogram } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  
  // Counters
  private workflowExecutionCounter: Counter;
  private workflowFailureCounter: Counter;
  
  // Gauges
  private queueSizeGauge: Gauge;
  private activeWorkersGauge: Gauge;
  
  // Histograms
  private executionDurationHistogram: Histogram;

  constructor() {
    // Initialize metrics
    this.workflowExecutionCounter = new Counter({
      name: 'workflow_executions_total',
      help: 'Total number of workflow executions',
      labelNames: ['workflow_id', 'status'],
    });

    this.workflowFailureCounter = new Counter({
      name: 'workflow_failures_total',
      help: 'Total number of workflow execution failures',
      labelNames: ['workflow_id', 'error_type'],
    });

    this.queueSizeGauge = new Gauge({
      name: 'workflow_queue_size',
      help: 'Current size of the workflow execution queue',
    });

    this.activeWorkersGauge = new Gauge({
      name: 'active_workers',
      help: 'Number of active worker instances',
    });

    this.executionDurationHistogram = new Histogram({
      name: 'workflow_execution_duration_seconds',
      help: 'Workflow execution duration in seconds',
      labelNames: ['workflow_id'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600],
    });
  }

  incrementExecutionCounter(workflowId: string, status: 'success' | 'failure') {
    this.workflowExecutionCounter.inc({ workflow_id: workflowId, status });
  }

  incrementFailureCounter(workflowId: string, errorType: string) {
    this.workflowFailureCounter.inc({ workflow_id: workflowId, error_type: errorType });
  }

  setQueueSize(size: number) {
    this.queueSizeGauge.set(size);
  }

  setActiveWorkers(count: number) {
    this.activeWorkersGauge.set(count);
  }

  recordExecutionDuration(workflowId: string, durationSeconds: number) {
    this.executionDurationHistogram.observe({ workflow_id: workflowId }, durationSeconds);
  }

  getMetrics() {
    return register.metrics();
  }
}
```

### B. Logging Strategy

```typescript
// apps/worker/src/monitoring/logging.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';

@Injectable()
export class LoggingService {
  private readonly logger: winston.Logger;
  private readonly nestLogger = new Logger(LoggingService.name);

  constructor(private readonly configService: ConfigService) {
    const transports = [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
          }),
        ),
      }),
    ];

    // Add Elasticsearch transport if configured
    const elasticsearchUrl = this.configService.get('ELASTICSEARCH_URL');
    if (elasticsearchUrl) {
      transports.push(
        new ElasticsearchTransport({
          level: 'info',
          clientOpts: { node: elasticsearchUrl },
          indexPrefix: 'jibu-worker-logs',
        }),
      );
    }

    this.logger = winston.createLogger({
      level: this.configService.get('LOG_LEVEL', 'info'),
      defaultMeta: { service: 'worker-service' },
      transports,
    });

    this.nestLogger.log('Logging service initialized');
  }

  log(message: string, context?: any) {
    this.logger.info(message, { context });
  }

  error(message: string, trace?: string, context?: any) {
    this.logger.error(message, { trace, context });
  }

  warn(message: string, context?: any) {
    this.logger.warn(message, { context });
  }

  debug(message: string, context?: any) {
    this.logger.debug(message, { context });
  }

  // Structured logging for workflow events
  logWorkflowEvent(eventType: string, workflowId: string, data?: any) {
    this.logger.info(`Workflow ${eventType}`, {
      workflowId,
      eventType,
      data,
      timestamp: new Date().toISOString(),
    });
  }
}
```

### C. Alerting System

```typescript
// apps/worker/src/monitoring/alert.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

interface Alert {
  title: string;
  message: string;
  severity: AlertSeverity;
  source: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);
  private readonly webhookUrl: string;
  private readonly alertThreshold: number = 5; // Minimum severity level to send alerts
  private alertCount: Record<string, number> = {};

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.webhookUrl = this.configService.get('ALERT_WEBHOOK_URL');
  }

  async sendAlert(alert: Omit<Alert, 'timestamp' | 'source'>) {
    if (!this.webhookUrl) {
      this.logger.warn('Alert webhook URL not configured, skipping alert');
      return;
    }

    const fullAlert: Alert = {
      ...alert,
      source: 'worker-service',
      timestamp: new Date().toISOString(),
    };

    // Rate limiting for similar alerts
    const alertKey = `${alert.severity}:${alert.title}`;
    this.alertCount[alertKey] = (this.alertCount[alertKey] || 0) + 1;

    // Only send the alert if it's critical, or if we haven't sent too many similar alerts
    if (alert.severity === AlertSeverity.CRITICAL || this.alertCount[alertKey] <= this.alertThreshold) {
      try {
        await firstValueFrom(
          this.httpService.post(this.webhookUrl, fullAlert),
        );
        this.logger.log(`Alert sent: ${alert.title}`);
      } catch (error) {
        this.logger.error(`Failed to send alert: ${error.message}`, error.stack);
      }
    }
  }

  // Helper methods for different alert types
  async sendErrorAlert(title: string, message: string, metadata?: Record<string, any>) {
    await this.sendAlert({
      title,
      message,
      severity: AlertSeverity.ERROR,
      metadata,
    });
  }

  async sendCriticalAlert(title: string, message: string, metadata?: Record<string, any>) {
    await this.sendAlert({
      title,
      message,
      severity: AlertSeverity.CRITICAL,
      metadata,
    });
  }
}
```

## 6. Deployment & Testing Strategy

### A. CI/CD Integration

```yaml
# .github/workflows/worker-ci.yml
name: Worker CI/CD

on:
  push:
    branches: [main]
    paths:
      - 'apps/worker/**'
      - 'libs/queue-definitions/**'
  pull_request:
    branches: [main]
    paths:
      - 'apps/worker/**'
      - 'libs/queue-definitions/**'

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'pnpm'
      - name: Install dependencies
        run: pnpm install
      - name: Lint
        run: pnpm nx lint worker
      - name: Test
        run: pnpm nx test worker
      - name: Build
        run: pnpm nx build worker
      - name: Upload build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: worker-dist
          path: dist/apps/worker

  deploy:
    needs: build-and-test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Download build artifacts
        uses: actions/download-artifact@v3
        with:
          name: worker-dist
          path: dist/apps/worker
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2
      - name: Login to Container Registry
        uses: docker/login-action@v2
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - name: Build and push Docker image
        uses: docker/build-push-action@v4
        with:
          context: .
          file: ./apps/worker/Dockerfile
          push: true
          tags: ghcr.io/${{ github.repository }}/worker:latest
      - name: Deploy to production
        run: |
          echo "Deploying worker to production..."
          # Add deployment commands here (e.g., kubectl apply, helm upgrade, etc.)
```

### B. Testing Approach

```typescript
// apps/worker/src/n8n/n8n-integration.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { N8nIntegrationService } from './n8n-integration.service';

describe('N8nIntegrationService', () => {
  let service: N8nIntegrationService;
  let httpService: HttpService;

  const mockHttpService = {
    post: jest.fn(),
    get: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockImplementation((key) => {
      const config = {
        'N8N_API_URL': 'http://n8n-api:5678/api/v1',
        'N8N_API_KEY': 'test-api-key',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        N8nIntegrationService,
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<N8nIntegrationService>(N8nIntegrationService);
    httpService = module.get<HttpService>(HttpService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('executeWorkflow', () => {
    it('should execute a workflow successfully', async () => {
      const workflowId = 'test-workflow-id';
      const executionData = { data: 'test-data' };
      const expectedResponse = { data: { executionId: 'test-execution-id' } };

      mockHttpService.post.mockReturnValue(of(expectedResponse));

      const result = await service.executeWorkflow(workflowId, executionData);

      expect(result).toEqual(expectedResponse.data);
      expect(mockHttpService.post).toHaveBeenCalledWith(
        'http://n8n-api:5678/api/v1/workflows/test-workflow-id/execute',
        executionData,
        {
          headers: {
            'X-N8N-API-KEY': 'test-api-key',
            'Content-Type': 'application/json',
          },
        },
      );
    });

    it('should handle errors when executing a workflow', async () => {
      const workflowId = 'test-workflow-id';
      const executionData = { data: 'test-data' };
      const errorResponse = new Error('API Error');

      mockHttpService.post.mockReturnValue(throwError(() => errorResponse));

      await expect(service.executeWorkflow(workflowId, executionData)).rejects.toThrow(
        'Failed to execute workflow: API Error',
      );
    });
  });
});
```

## 7. Security Considerations

### A. Authentication & Authorization

```typescript
// apps/worker/src/auth/auth.guard.ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = this.extractApiKeyFromHeader(request);
    
    if (!apiKey) {
      throw new UnauthorizedException('API key is missing');
    }
    
    const validApiKey = this.configService.get<string>('WORKER_API_KEY');
    if (apiKey !== validApiKey) {
      throw new UnauthorizedException('Invalid API key');
    }
    
    return true;
  }

  private extractApiKeyFromHeader(request: Request): string | undefined {
    const apiKey = request.headers['x-api-key'];
    return Array.isArray(apiKey) ? apiKey[0] : apiKey;
  }
}

// apps/worker/src/auth/jwt.guard.ts
import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);
    
    if (!token) {
      throw new UnauthorizedException('JWT token is missing');
    }
    
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
      
      // Attach payload to request object for use in controllers
      request['user'] = payload;
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid JWT token');
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return undefined;
    }
    
    return authHeader.substring(7); // Remove 'Bearer ' prefix
  }
}
```

### B. Data Protection

```typescript
// apps/worker/src/common/encryption.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly encryptionKey: Buffer;

  constructor(private readonly configService: ConfigService) {
    const key = this.configService.get<string>('ENCRYPTION_KEY');
    if (!key) {
      this.logger.error('ENCRYPTION_KEY not found in environment variables');
      throw new Error('ENCRYPTION_KEY is required for encryption service');
    }
    
    // Use SHA-256 to derive a 32-byte key from the provided key string
    this.encryptionKey = crypto.createHash('sha256').update(key).digest();
  }

  encrypt(text: string): string {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      // Return IV + Auth Tag + Encrypted data
      return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    } catch (error) {
      this.logger.error('Encryption failed', error);
      throw new Error('Failed to encrypt data');
    }
  }

  decrypt(encryptedText: string): string {
    try {
      const parts = encryptedText.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted text format');
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encryptedData = parts[2];
      
      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      this.logger.error('Decryption failed', error);
      throw new Error('Failed to decrypt data');
    }
  }
}
```

## 8. Implementation Roadmap

### Phase 1: Core Worker Setup (Week 1-2)
- Set up basic worker application structure
- Implement n8n API integration
- Create queue management system
- Implement basic workflow execution

### Phase 2: Resilience & Scaling (Week 3-4)
- Add retry mechanisms and circuit breakers
- Implement dead letter queue
- Set up worker scaling based on queue size
- Add monitoring and metrics collection

### Phase 3: Security & Deployment (Week 5-6)
- Implement authentication and authorization
- Add data encryption for sensitive information
- Set up CI/CD pipeline
- Deploy to production environment

### Phase 4: Testing & Optimization (Week 7-8)
- Comprehensive testing (unit, integration, load)
- Performance optimization
- Documentation
- User training and handover