import { WebhookCacheService, IRedisService, CachedWebhookUrl } from '../webhook-cache.service';

describe('WebhookCacheService', () => {
  let service: WebhookCacheService;
  let mockRedis: jest.Mocked<IRedisService>;

  beforeEach(() => {
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
    };

    service = new WebhookCacheService(mockRedis);
    // Initialize the service to start cleanup timers
    service.onModuleInit();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getWebhookUrl', () => {
    it('should get from memory cache first (voice workflows)', async () => {
      const workflowId = 'voice-workflow-1';
      const url = 'https://n8n.yourdomain.com/webhook/path1';

      // Manually set in memory cache
      const cached: CachedWebhookUrl = {
        webhookUrl: url,
        workflowId,
        resolvedAt: Date.now(),
        isVoiceWorkflow: true,
      };
      service['memoryCache'].set(workflowId, cached);
      service['cacheAccessTimes'].set(workflowId, Date.now());

      const result = await service.getWebhookUrl(workflowId, true);
      
      expect(result).toBe(url);
      expect(mockRedis.get).not.toHaveBeenCalled();
    });

    it('should fall back to Redis when memory cache misses', async () => {
      const workflowId = 'non-voice-workflow-1';
      const url = 'https://n8n.yourdomain.com/webhook/path2';

      const cached: CachedWebhookUrl = {
        webhookUrl: url,
        workflowId,
        resolvedAt: Date.now(),
        isVoiceWorkflow: false,
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(cached));
      mockRedis.set.mockResolvedValue(true);

      const result = await service.getWebhookUrl(workflowId, false);
      
      expect(result).toBe(url);
      expect(mockRedis.get).toHaveBeenCalledWith(`webhook:url:${workflowId}`);
    });

    it('should return null on complete cache miss', async () => {
      const workflowId = 'missing-workflow';

      mockRedis.get.mockResolvedValue(null);

      const result = await service.getWebhookUrl(workflowId, false);
      
      expect(result).toBeNull();
    });

    it('should use voice Redis namespace for voice workflows', async () => {
      const workflowId = 'voice-workflow-2';
      const url = 'https://n8n.yourdomain.com/webhook/voice-path';

      const cached: CachedWebhookUrl = {
        webhookUrl: url,
        workflowId,
        resolvedAt: Date.now(),
        isVoiceWorkflow: true,
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(cached));
      mockRedis.set.mockResolvedValue(true);

      await service.getWebhookUrl(workflowId, true);
      
      expect(mockRedis.get).toHaveBeenCalledWith(`voice:webhook:url:${workflowId}`);
    });
  });

  describe('setWebhookUrl', () => {
    it('should set in both Redis and memory cache for voice workflows', async () => {
      const workflowId = 'voice-workflow-3';
      const url = 'https://n8n.yourdomain.com/webhook/path3';

      mockRedis.set.mockResolvedValue(true);

      await service.setWebhookUrl(workflowId, url, true);

      expect(mockRedis.set).toHaveBeenCalled();
      expect(service['memoryCache'].has(workflowId)).toBe(true);
      expect(service['memoryCache'].get(workflowId)?.webhookUrl).toBe(url);
    });

    it('should set only in Redis for non-voice workflows', async () => {
      const workflowId = 'non-voice-workflow-2';
      const url = 'https://n8n.yourdomain.com/webhook/path4';

      mockRedis.set.mockResolvedValue(true);

      await service.setWebhookUrl(workflowId, url, false);

      expect(mockRedis.set).toHaveBeenCalled();
      expect(service['memoryCache'].has(workflowId)).toBe(false);
    });
  });

  describe('invalidate', () => {
    it('should invalidate cache on publish', async () => {
      const workflowId = 'workflow-1';

      // Set in memory cache first
      service['memoryCache'].set(workflowId, {
        webhookUrl: 'test',
        workflowId,
        resolvedAt: Date.now(),
      });

      mockRedis.del.mockResolvedValue(true);

      await service.invalidate(workflowId);

      expect(mockRedis.del).toHaveBeenCalledWith(`webhook:url:${workflowId}`);
      expect(mockRedis.del).toHaveBeenCalledWith(`voice:webhook:url:${workflowId}`);
      expect(mockRedis.del).toHaveBeenCalledWith(`webhook:version:${workflowId}`);
      expect(service['memoryCache'].has(workflowId)).toBe(false);
    });
  });

  describe('circuit breaker', () => {
    it('should trigger circuit breaker after threshold failures', () => {
      const workflowId = 'failing-workflow';

      // Simulate failures
      for (let i = 0; i < 3; i++) {
        service['incrementFailureCount'](workflowId);
      }

      expect(service.shouldTriggerCircuitBreaker(workflowId)).toBe(true);
    });

    it('should reset circuit breaker', () => {
      const workflowId = 'reset-workflow';

      // Simulate failures
      service['incrementFailureCount'](workflowId);
      service['incrementFailureCount'](workflowId);

      expect(service.shouldTriggerCircuitBreaker(workflowId)).toBe(false);

      // Reset
      service.resetCircuitBreaker(workflowId);

      expect(service.shouldTriggerCircuitBreaker(workflowId)).toBe(false);
    });
  });

  describe('metrics', () => {
    it('should track cache hits and misses', async () => {
      const workflowId = 'metrics-workflow';

      // Cache miss
      mockRedis.get.mockResolvedValue(null);
      await service.getWebhookUrl(workflowId, false);

      // Cache hit
      const cached: CachedWebhookUrl = {
        webhookUrl: 'test',
        workflowId,
        resolvedAt: Date.now(),
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(cached));
      mockRedis.set.mockResolvedValue(true);
      await service.getWebhookUrl(workflowId, false);

      const metrics = service.getMetrics();

      expect(metrics.totalMisses).toBeGreaterThan(0);
      expect(metrics.totalHits).toBeGreaterThan(0);
    });
  });

  describe('LRU eviction', () => {
    it('should evict least recently used entry when cache is full', async () => {
      mockRedis.set.mockResolvedValue(true);

      // Fill cache to max size
      for (let i = 0; i < 101; i++) {
        await service.setWebhookUrl(`workflow-${i}`, `url-${i}`, true);
      }

      // First entry should be evicted
      expect(service['memoryCache'].has('workflow-0')).toBe(false);
      expect(service['memoryCache'].size).toBeLessThanOrEqual(100);
    });
  });

  describe('Connection Context Management', () => {
    it('should store connection context', async () => {
      const connectionId = 'conn-123';
      const context = {
        workflowId: 'workflow-1',
        sessionId: 'session-1',
        callSid: 'CA123456',
        startTime: Date.now(),
        lastHeartbeat: Date.now(),
        isActive: true,
      };

      mockRedis.set.mockResolvedValue(true);

      await service.setConnectionContext(connectionId, context);

      expect(mockRedis.set).toHaveBeenCalledWith(
        `voice:connection:${connectionId}`,
        JSON.stringify(context),
        300 // 5 minutes TTL
      );
      expect(mockRedis.set).toHaveBeenCalledWith(
        `voice:connection:index:${context.workflowId}:${context.sessionId}`,
        connectionId,
        300
      );
    });

    it('should retrieve connection context by ID', async () => {
      const connectionId = 'conn-456';
      const context = {
        workflowId: 'workflow-2',
        sessionId: 'session-2',
        callSid: 'CA789012',
        startTime: Date.now(),
        lastHeartbeat: Date.now(),
        isActive: true,
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(context));

      const result = await service.getConnectionContext(connectionId);

      expect(result).toEqual(context);
      expect(mockRedis.get).toHaveBeenCalledWith(`voice:connection:${connectionId}`);
    });

    it('should retrieve connection context by session', async () => {
      const workflowId = 'workflow-3';
      const sessionId = 'session-3';
      const connectionId = 'conn-789';
      const context = {
        workflowId,
        sessionId,
        callSid: 'CA345678',
        startTime: Date.now(),
        lastHeartbeat: Date.now(),
        isActive: true,
      };

      mockRedis.get
        .mockResolvedValueOnce(connectionId) // Index lookup
        .mockResolvedValueOnce(JSON.stringify(context)); // Context retrieval

      const result = await service.getConnectionContextBySession(workflowId, sessionId);

      expect(result).toEqual(context);
      expect(mockRedis.get).toHaveBeenCalledWith(`voice:connection:index:${workflowId}:${sessionId}`);
      expect(mockRedis.get).toHaveBeenCalledWith(`voice:connection:${connectionId}`);
    });

    it('should update connection heartbeat', async () => {
      const connectionId = 'conn-heartbeat';
      const context = {
        workflowId: 'workflow-4',
        sessionId: 'session-4',
        callSid: 'CA901234',
        startTime: Date.now() - 60000,
        lastHeartbeat: Date.now() - 60000,
        isActive: true,
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(context));
      mockRedis.set.mockResolvedValue(true);

      await service.updateConnectionHeartbeat(connectionId);

      expect(mockRedis.get).toHaveBeenCalledWith(`voice:connection:${connectionId}`);
      expect(mockRedis.set).toHaveBeenCalled();
      
      // Verify heartbeat was updated
      const setCall = mockRedis.set.mock.calls[0];
      const updatedContext = JSON.parse(setCall[1] as string);
      expect(updatedContext.lastHeartbeat).toBeGreaterThan(context.lastHeartbeat);
    });

    it('should remove connection context', async () => {
      const connectionId = 'conn-remove';
      const context = {
        workflowId: 'workflow-5',
        sessionId: 'session-5',
        callSid: 'CA567890',
        startTime: Date.now(),
        lastHeartbeat: Date.now(),
        isActive: true,
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(context));
      mockRedis.del.mockResolvedValue(true);

      await service.removeConnectionContext(connectionId);

      expect(mockRedis.del).toHaveBeenCalledWith(`voice:connection:index:${context.workflowId}:${context.sessionId}`);
      expect(mockRedis.del).toHaveBeenCalledWith(`voice:connection:${connectionId}`);
    });

    it('should check if connection is active', async () => {
      const connectionId = 'conn-active';
      const context = {
        workflowId: 'workflow-6',
        sessionId: 'session-6',
        callSid: 'CA123789',
        startTime: Date.now(),
        lastHeartbeat: Date.now() - 10000, // 10 seconds ago
        isActive: true,
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(context));

      const result = await service.isConnectionActive(connectionId, 30000);

      expect(result).toBe(true);
    });

    it('should detect inactive connection', async () => {
      const connectionId = 'conn-inactive';
      const context = {
        workflowId: 'workflow-7',
        sessionId: 'session-7',
        callSid: 'CA456123',
        startTime: Date.now(),
        lastHeartbeat: Date.now() - 60000, // 60 seconds ago
        isActive: true,
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(context));

      const result = await service.isConnectionActive(connectionId, 30000);

      expect(result).toBe(false);
    });

    it('should handle missing connection context gracefully', async () => {
      const connectionId = 'conn-missing';

      mockRedis.get.mockResolvedValue(null);

      const result = await service.getConnectionContext(connectionId);

      expect(result).toBeNull();
    });
  });
});
