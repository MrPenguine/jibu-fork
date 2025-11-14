import { Test, TestingModule } from '@nestjs/testing';
import { ConnectionService } from '../connection.service';
import { WebhookCacheService } from '@jibu/cache-utils';

describe('ConnectionService', () => {
  let service: ConnectionService;
  let mockCacheService: jest.Mocked<WebhookCacheService>;

  beforeEach(async () => {
    mockCacheService = {
      setConnectionContext: jest.fn(),
      getConnectionContext: jest.fn(),
      getConnectionContextBySession: jest.fn(),
      updateConnectionHeartbeat: jest.fn(),
      removeConnectionContext: jest.fn(),
      isConnectionActive: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConnectionService,
        {
          provide: WebhookCacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<ConnectionService>(ConnectionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createConnection', () => {
    it('should create a new connection with unique ID', async () => {
      const workflowId = 'workflow-123';
      const sessionId = 'session-456';
      const callSid = 'CA123456789';
      const metadata = { agentName: 'Support Agent' };

      mockCacheService.setConnectionContext.mockResolvedValue(undefined);

      const connectionId = await service.createConnection(
        workflowId,
        sessionId,
        callSid,
        metadata
      );

      expect(connectionId).toBeDefined();
      expect(connectionId).toMatch(/^conn_/);
      expect(mockCacheService.setConnectionContext).toHaveBeenCalledWith(
        connectionId,
        expect.objectContaining({
          workflowId,
          sessionId,
          callSid,
          isActive: true,
          metadata,
        })
      );
    });

    it('should generate unique connection IDs', async () => {
      const workflowId = 'workflow-123';
      const sessionId = 'session-456';

      mockCacheService.setConnectionContext.mockResolvedValue(undefined);

      const id1 = await service.createConnection(workflowId, sessionId);
      const id2 = await service.createConnection(workflowId, sessionId);

      expect(id1).not.toBe(id2);
    });

    it('should create connection without optional parameters', async () => {
      const workflowId = 'workflow-123';
      const sessionId = 'session-456';

      mockCacheService.setConnectionContext.mockResolvedValue(undefined);

      const connectionId = await service.createConnection(workflowId, sessionId);

      expect(connectionId).toBeDefined();
      expect(mockCacheService.setConnectionContext).toHaveBeenCalledWith(
        connectionId,
        expect.objectContaining({
          workflowId,
          sessionId,
          callSid: undefined,
          metadata: undefined,
        })
      );
    });
  });

  describe('getConnection', () => {
    it('should retrieve connection by ID', async () => {
      const connectionId = 'conn-123';
      const context = {
        workflowId: 'workflow-1',
        sessionId: 'session-1',
        callSid: 'CA123',
        startTime: Date.now(),
        lastHeartbeat: Date.now(),
        isActive: true,
      };

      mockCacheService.getConnectionContext.mockResolvedValue(context);

      const result = await service.getConnection(connectionId);

      expect(result).toEqual(context);
      expect(mockCacheService.getConnectionContext).toHaveBeenCalledWith(connectionId);
    });

    it('should return null for non-existent connection', async () => {
      const connectionId = 'conn-nonexistent';

      mockCacheService.getConnectionContext.mockResolvedValue(null);

      const result = await service.getConnection(connectionId);

      expect(result).toBeNull();
    });
  });

  describe('getConnectionBySession', () => {
    it('should retrieve connection by workflow and session', async () => {
      const workflowId = 'workflow-1';
      const sessionId = 'session-1';
      const context = {
        workflowId,
        sessionId,
        callSid: 'CA123',
        startTime: Date.now(),
        lastHeartbeat: Date.now(),
        isActive: true,
      };

      mockCacheService.getConnectionContextBySession.mockResolvedValue(context);

      const result = await service.getConnectionBySession(workflowId, sessionId);

      expect(result).toEqual(context);
      expect(mockCacheService.getConnectionContextBySession).toHaveBeenCalledWith(
        workflowId,
        sessionId
      );
    });
  });

  describe('updateHeartbeat', () => {
    it('should update connection heartbeat', async () => {
      const connectionId = 'conn-123';

      mockCacheService.updateConnectionHeartbeat.mockResolvedValue(undefined);

      await service.updateHeartbeat(connectionId);

      expect(mockCacheService.updateConnectionHeartbeat).toHaveBeenCalledWith(connectionId);
    });
  });

  describe('updateMetadata', () => {
    it('should update connection metadata', async () => {
      const connectionId = 'conn-123';
      const existingContext = {
        workflowId: 'workflow-1',
        sessionId: 'session-1',
        callSid: 'CA123',
        startTime: Date.now(),
        lastHeartbeat: Date.now(),
        isActive: true,
        metadata: { agentName: 'Agent 1' },
      };
      const newMetadata = { customerType: 'premium' };

      mockCacheService.getConnectionContext.mockResolvedValue(existingContext);
      mockCacheService.setConnectionContext.mockResolvedValue(undefined);

      await service.updateMetadata(connectionId, newMetadata);

      expect(mockCacheService.setConnectionContext).toHaveBeenCalledWith(
        connectionId,
        expect.objectContaining({
          metadata: { agentName: 'Agent 1', customerType: 'premium' },
        })
      );
    });

    it('should handle missing connection gracefully', async () => {
      const connectionId = 'conn-nonexistent';
      const newMetadata = { test: 'value' };

      mockCacheService.getConnectionContext.mockResolvedValue(null);

      await service.updateMetadata(connectionId, newMetadata);

      expect(mockCacheService.setConnectionContext).not.toHaveBeenCalled();
    });
  });

  describe('endConnection', () => {
    it('should mark connection as inactive', async () => {
      const connectionId = 'conn-123';
      const context = {
        workflowId: 'workflow-1',
        sessionId: 'session-1',
        callSid: 'CA123',
        startTime: Date.now(),
        lastHeartbeat: Date.now(),
        isActive: true,
      };

      mockCacheService.getConnectionContext.mockResolvedValue(context);
      mockCacheService.setConnectionContext.mockResolvedValue(undefined);
      mockCacheService.removeConnectionContext.mockResolvedValue(undefined);

      await service.endConnection(connectionId);

      expect(mockCacheService.setConnectionContext).toHaveBeenCalledWith(
        connectionId,
        expect.objectContaining({
          isActive: false,
        })
      );
    });

    it('should handle missing connection gracefully', async () => {
      const connectionId = 'conn-nonexistent';

      mockCacheService.getConnectionContext.mockResolvedValue(null);

      await service.endConnection(connectionId);

      expect(mockCacheService.setConnectionContext).not.toHaveBeenCalled();
    });
  });

  describe('removeConnection', () => {
    it('should remove connection immediately', async () => {
      const connectionId = 'conn-123';

      mockCacheService.removeConnectionContext.mockResolvedValue(undefined);

      await service.removeConnection(connectionId);

      expect(mockCacheService.removeConnectionContext).toHaveBeenCalledWith(connectionId);
    });
  });

  describe('isConnectionActive', () => {
    it('should check if connection is active', async () => {
      const connectionId = 'conn-123';

      mockCacheService.isConnectionActive.mockResolvedValue(true);

      const result = await service.isConnectionActive(connectionId);

      expect(result).toBe(true);
      expect(mockCacheService.isConnectionActive).toHaveBeenCalledWith(connectionId, 30000);
    });

    it('should use custom max idle time', async () => {
      const connectionId = 'conn-123';
      const maxIdleMs = 60000;

      mockCacheService.isConnectionActive.mockResolvedValue(false);

      const result = await service.isConnectionActive(connectionId, maxIdleMs);

      expect(result).toBe(false);
      expect(mockCacheService.isConnectionActive).toHaveBeenCalledWith(connectionId, maxIdleMs);
    });
  });

  describe('getHeartbeatInterval', () => {
    it('should return 15 seconds', () => {
      const interval = service.getHeartbeatInterval();
      expect(interval).toBe(15000);
    });
  });

  describe('getConnectionTimeout', () => {
    it('should return 5 minutes', () => {
      const timeout = service.getConnectionTimeout();
      expect(timeout).toBe(5 * 60 * 1000);
    });
  });
});
