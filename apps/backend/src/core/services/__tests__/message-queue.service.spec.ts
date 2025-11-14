import { Test, TestingModule } from '@nestjs/testing';
import { MessageQueueService, WebhookPriority } from '../message-queue.service';
import { getQueueToken } from '@nestjs/bull';
import { WebhookCacheService } from '@jibu/cache-utils';
import { ConnectionService } from '../connection.service';
import { QUEUE_NAMES } from '@jibu/queue-definitions';

describe('MessageQueueService', () => {
  let service: MessageQueueService;
  let mockQueue: any;
  let mockCacheService: jest.Mocked<WebhookCacheService>;
  let mockConnectionService: jest.Mocked<ConnectionService>;

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn(),
      getWaitingCount: jest.fn(),
      getActiveCount: jest.fn(),
      getCompletedCount: jest.fn(),
      getFailedCount: jest.fn(),
      getDelayedCount: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      clean: jest.fn(),
    };

    mockCacheService = {
      getWebhookUrl: jest.fn(),
      shouldTriggerCircuitBreaker: jest.fn(),
    } as any;

    mockConnectionService = {
      getConnection: jest.fn(),
      updateHeartbeat: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageQueueService,
        {
          provide: getQueueToken(QUEUE_NAMES.WEBHOOK_DELIVERY),
          useValue: mockQueue,
        },
        {
          provide: WebhookCacheService,
          useValue: mockCacheService,
        },
        {
          provide: ConnectionService,
          useValue: mockConnectionService,
        },
      ],
    }).compile();

    service = module.get<MessageQueueService>(MessageQueueService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendMessageToWorkflow', () => {
    it('should enqueue non-voice message with low priority', async () => {
      const workflowId = 'workflow-123';
      const sessionId = 'session-456';
      const payload = { text: 'Hello world' };

      mockCacheService.getWebhookUrl.mockResolvedValue('https://n8n.example.com/webhook/123');
      mockCacheService.shouldTriggerCircuitBreaker.mockReturnValue(false);
      mockQueue.add.mockResolvedValue({ id: 'job-123' });

      await service.sendMessageToWorkflow(workflowId, sessionId, payload);

      expect(mockQueue.add).toHaveBeenCalledWith(
        'deliver-webhook',
        expect.objectContaining({
          workflowId,
          sessionId,
          payload,
          isVoice: false,
          priority: WebhookPriority.NON_VOICE,
        }),
        expect.objectContaining({
          priority: WebhookPriority.NON_VOICE,
        })
      );
    });

    it('should reject message when circuit breaker is open', async () => {
      const workflowId = 'workflow-123';
      const sessionId = 'session-456';
      const payload = { text: 'Hello world' };

      mockCacheService.getWebhookUrl.mockResolvedValue('https://n8n.example.com/webhook/123');
      mockCacheService.shouldTriggerCircuitBreaker.mockReturnValue(true);

      await expect(
        service.sendMessageToWorkflow(workflowId, sessionId, payload)
      ).rejects.toThrow('Circuit breaker open for workflow workflow-123');

      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('should log warning when webhook URL not in cache', async () => {
      const workflowId = 'workflow-123';
      const sessionId = 'session-456';
      const payload = { text: 'Hello world' };

      mockCacheService.getWebhookUrl.mockResolvedValue(null);
      mockCacheService.shouldTriggerCircuitBreaker.mockReturnValue(false);
      mockQueue.add.mockResolvedValue({ id: 'job-123' });

      await service.sendMessageToWorkflow(workflowId, sessionId, payload);

      expect(mockQueue.add).toHaveBeenCalled();
    });
  });

  describe('sendCallEventToWorkflow', () => {
    it('should enqueue voice event with high priority', async () => {
      const workflowId = 'workflow-123';
      const sessionId = 'session-456';
      const payload = { type: 'user_message', text: 'Hello' };
      const connectionId = 'conn-789';

      mockCacheService.getWebhookUrl.mockResolvedValue('https://n8n.example.com/webhook/123');
      mockCacheService.shouldTriggerCircuitBreaker.mockReturnValue(false);
      mockConnectionService.getConnection.mockResolvedValue({
        workflowId,
        sessionId,
        callSid: 'CA123',
        startTime: Date.now(),
        lastHeartbeat: Date.now(),
        isActive: true,
      });
      mockConnectionService.updateHeartbeat.mockResolvedValue(undefined);
      mockQueue.add.mockResolvedValue({ id: 'job-123' });

      await service.sendCallEventToWorkflow(
        workflowId,
        sessionId,
        payload,
        connectionId,
        true
      );

      expect(mockQueue.add).toHaveBeenCalledWith(
        'deliver-webhook',
        expect.objectContaining({
          workflowId,
          sessionId,
          payload,
          isVoice: true,
          connectionId,
          priority: WebhookPriority.VOICE_HIGH,
        }),
        expect.objectContaining({
          priority: WebhookPriority.VOICE_HIGH,
          attempts: 2,
          timeout: 5000,
        })
      );
    });

    it('should enqueue voice event with normal priority when highPriority is false', async () => {
      const workflowId = 'workflow-123';
      const sessionId = 'session-456';
      const payload = { type: 'user_message', text: 'Hello' };
      const connectionId = 'conn-789';

      mockCacheService.getWebhookUrl.mockResolvedValue('https://n8n.example.com/webhook/123');
      mockCacheService.shouldTriggerCircuitBreaker.mockReturnValue(false);
      mockConnectionService.getConnection.mockResolvedValue({
        workflowId,
        sessionId,
        callSid: 'CA123',
        startTime: Date.now(),
        lastHeartbeat: Date.now(),
        isActive: true,
      });
      mockConnectionService.updateHeartbeat.mockResolvedValue(undefined);
      mockQueue.add.mockResolvedValue({ id: 'job-123' });

      await service.sendCallEventToWorkflow(
        workflowId,
        sessionId,
        payload,
        connectionId,
        false
      );

      expect(mockQueue.add).toHaveBeenCalledWith(
        'deliver-webhook',
        expect.objectContaining({
          priority: WebhookPriority.VOICE_NORMAL,
        }),
        expect.objectContaining({
          priority: WebhookPriority.VOICE_NORMAL,
        })
      );
    });

    it('should update heartbeat after enqueuing', async () => {
      const workflowId = 'workflow-123';
      const sessionId = 'session-456';
      const payload = { type: 'user_message', text: 'Hello' };
      const connectionId = 'conn-789';

      mockCacheService.getWebhookUrl.mockResolvedValue('https://n8n.example.com/webhook/123');
      mockCacheService.shouldTriggerCircuitBreaker.mockReturnValue(false);
      mockConnectionService.getConnection.mockResolvedValue({
        workflowId,
        sessionId,
        callSid: 'CA123',
        startTime: Date.now(),
        lastHeartbeat: Date.now(),
        isActive: true,
      });
      mockConnectionService.updateHeartbeat.mockResolvedValue(undefined);
      mockQueue.add.mockResolvedValue({ id: 'job-123' });

      await service.sendCallEventToWorkflow(
        workflowId,
        sessionId,
        payload,
        connectionId,
        true
      );

      expect(mockConnectionService.updateHeartbeat).toHaveBeenCalledWith(connectionId);
    });

    it('should warn when connection is not active', async () => {
      const workflowId = 'workflow-123';
      const sessionId = 'session-456';
      const payload = { type: 'user_message', text: 'Hello' };
      const connectionId = 'conn-789';

      mockCacheService.getWebhookUrl.mockResolvedValue('https://n8n.example.com/webhook/123');
      mockCacheService.shouldTriggerCircuitBreaker.mockReturnValue(false);
      mockConnectionService.getConnection.mockResolvedValue({
        workflowId,
        sessionId,
        callSid: 'CA123',
        startTime: Date.now(),
        lastHeartbeat: Date.now(),
        isActive: false,
      });
      mockConnectionService.updateHeartbeat.mockResolvedValue(undefined);
      mockQueue.add.mockResolvedValue({ id: 'job-123' });

      await service.sendCallEventToWorkflow(
        workflowId,
        sessionId,
        payload,
        connectionId,
        true
      );

      expect(mockQueue.add).toHaveBeenCalled();
    });

    it('should proceed when connection not found', async () => {
      const workflowId = 'workflow-123';
      const sessionId = 'session-456';
      const payload = { type: 'user_message', text: 'Hello' };
      const connectionId = 'conn-789';

      mockCacheService.getWebhookUrl.mockResolvedValue('https://n8n.example.com/webhook/123');
      mockCacheService.shouldTriggerCircuitBreaker.mockReturnValue(false);
      mockConnectionService.getConnection.mockResolvedValue(null);
      mockConnectionService.updateHeartbeat.mockResolvedValue(undefined);
      mockQueue.add.mockResolvedValue({ id: 'job-123' });

      await service.sendCallEventToWorkflow(
        workflowId,
        sessionId,
        payload,
        connectionId,
        true
      );

      expect(mockQueue.add).toHaveBeenCalled();
    });

    it('should reject voice event when circuit breaker is open', async () => {
      const workflowId = 'workflow-123';
      const sessionId = 'session-456';
      const payload = { type: 'user_message', text: 'Hello' };
      const connectionId = 'conn-789';

      mockCacheService.getWebhookUrl.mockResolvedValue('https://n8n.example.com/webhook/123');
      mockCacheService.shouldTriggerCircuitBreaker.mockReturnValue(true);

      await expect(
        service.sendCallEventToWorkflow(workflowId, sessionId, payload, connectionId, true)
      ).rejects.toThrow('Circuit breaker open for workflow workflow-123');

      expect(mockQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      mockQueue.getWaitingCount.mockResolvedValue(10);
      mockQueue.getActiveCount.mockResolvedValue(5);
      mockQueue.getCompletedCount.mockResolvedValue(100);
      mockQueue.getFailedCount.mockResolvedValue(2);
      mockQueue.getDelayedCount.mockResolvedValue(3);

      const stats = await service.getQueueStats();

      expect(stats).toEqual({
        waiting: 10,
        active: 5,
        completed: 100,
        failed: 2,
        delayed: 3,
        total: 18,
      });
    });
  });

  describe('getQueueHealth', () => {
    it('should return healthy when queue is normal', async () => {
      mockQueue.getWaitingCount.mockResolvedValue(50);
      mockQueue.getActiveCount.mockResolvedValue(5);
      mockQueue.getCompletedCount.mockResolvedValue(100);
      mockQueue.getFailedCount.mockResolvedValue(2);
      mockQueue.getDelayedCount.mockResolvedValue(0);

      const health = await service.getQueueHealth();

      expect(health).toEqual({ healthy: true });
    });

    it('should return unhealthy when too many waiting jobs', async () => {
      mockQueue.getWaitingCount.mockResolvedValue(150);
      mockQueue.getActiveCount.mockResolvedValue(5);
      mockQueue.getCompletedCount.mockResolvedValue(100);
      mockQueue.getFailedCount.mockResolvedValue(2);
      mockQueue.getDelayedCount.mockResolvedValue(0);

      const health = await service.getQueueHealth();

      expect(health).toEqual({
        healthy: false,
        reason: 'Too many waiting jobs: 150',
      });
    });

    it('should return unhealthy when too many failed jobs', async () => {
      mockQueue.getWaitingCount.mockResolvedValue(10);
      mockQueue.getActiveCount.mockResolvedValue(5);
      mockQueue.getCompletedCount.mockResolvedValue(100);
      mockQueue.getFailedCount.mockResolvedValue(60);
      mockQueue.getDelayedCount.mockResolvedValue(0);

      const health = await service.getQueueHealth();

      expect(health).toEqual({
        healthy: false,
        reason: 'Too many failed jobs: 60',
      });
    });

    it('should handle errors gracefully', async () => {
      mockQueue.getWaitingCount.mockRejectedValue(new Error('Redis connection failed'));

      const health = await service.getQueueHealth();

      expect(health.healthy).toBe(false);
      expect(health.reason).toContain('Queue health check failed');
    });
  });

  describe('pauseQueue', () => {
    it('should pause the queue', async () => {
      mockQueue.pause.mockResolvedValue(undefined);

      await service.pauseQueue();

      expect(mockQueue.pause).toHaveBeenCalled();
    });
  });

  describe('resumeQueue', () => {
    it('should resume the queue', async () => {
      mockQueue.resume.mockResolvedValue(undefined);

      await service.resumeQueue();

      expect(mockQueue.resume).toHaveBeenCalled();
    });
  });

  describe('cleanCompletedJobs', () => {
    it('should clean completed jobs', async () => {
      mockQueue.clean.mockResolvedValue(undefined);

      await service.cleanCompletedJobs(60000);

      expect(mockQueue.clean).toHaveBeenCalledWith(60000, 'completed');
    });
  });

  describe('cleanFailedJobs', () => {
    it('should clean failed jobs', async () => {
      mockQueue.clean.mockResolvedValue(undefined);

      await service.cleanFailedJobs(3600000);

      expect(mockQueue.clean).toHaveBeenCalledWith(3600000, 'failed');
    });
  });
});
