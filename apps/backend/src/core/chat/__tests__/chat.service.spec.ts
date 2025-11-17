import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from '../chat.service';
import { RedisService } from '../../redis/redis.service';
import { RagContextService } from '../../services/rag-context.service';
import { NotFoundException } from '@nestjs/common';
import { CHAT_REDIS_KEYS, CHAT_TTL_CONFIG } from '../chat.interfaces';

describe('ChatService', () => {
  let service: ChatService;
  let redisService: jest.Mocked<RedisService>;
  let ragContextService: jest.Mocked<RagContextService>;
  let mockRedisClient: any;

  beforeEach(async () => {
    // Mock Redis client
    mockRedisClient = {
      zadd: jest.fn().mockResolvedValue(1),
      zrange: jest.fn().mockResolvedValue([]),
      expire: jest.fn().mockResolvedValue(1),
      sadd: jest.fn().mockResolvedValue(1),
      srem: jest.fn().mockResolvedValue(1),
      smembers: jest.fn().mockResolvedValue([]),
    };

    // Mock RedisService
    const mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      redisClient: mockRedisClient,
    };

    // Mock RagContextService
    const mockRagContextService = {
      getRagContext: jest.fn().mockResolvedValue({
        results: [],
        query: '',
        fallbackMessage: "I'm having trouble accessing that information right now.",
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: RedisService, useValue: mockRedisService },
        { provide: RagContextService, useValue: mockRagContextService },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    redisService = module.get(RedisService) as jest.Mocked<RedisService>;
    ragContextService = module.get(RagContextService) as jest.Mocked<RagContextService>;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createConversation', () => {
    it('should create a conversation with proper structure', async () => {
      redisService.set.mockResolvedValue(true);

      const sessionId = 'test-session-123';
      const options = {
        workflowId: 'workflow-123',
        workspaceId: 'workspace-123',
        userId: 'user-123',
      };

      const conversation = await service.createConversation(sessionId, options);

      expect(conversation).toBeDefined();
      expect(conversation.sessionId).toBe(sessionId);
      expect(conversation.workflowId).toBe(options.workflowId);
      expect(conversation.workspaceId).toBe(options.workspaceId);
      expect(conversation.status).toBe('active');
      expect(conversation.participants).toHaveLength(2);

      // Verify Redis calls
      expect(redisService.set).toHaveBeenCalledWith(
        CHAT_REDIS_KEYS.CONVERSATION(sessionId),
        expect.any(String),
        CHAT_TTL_CONFIG.CONVERSATION_TTL,
      );
      expect(mockRedisClient.sadd).toHaveBeenCalledWith(
        CHAT_REDIS_KEYS.ACTIVE_SESSIONS,
        sessionId,
      );
      expect(mockRedisClient.sadd).toHaveBeenCalledWith(
        CHAT_REDIS_KEYS.USER_SESSIONS(options.userId),
        sessionId,
      );
    });

    it('should create conversation with initial context', async () => {
      redisService.set.mockResolvedValue(true);

      const sessionId = 'test-session-123';
      const options = {
        workflowId: 'workflow-123',
        workspaceId: 'workspace-123',
        initialContext: {
          systemPrompt: 'You are a helpful assistant',
          systemMessage: 'Hello!',
        },
      };

      const conversation = await service.createConversation(sessionId, options);

      expect(conversation.context).toEqual(options.initialContext);
    });
  });

  describe('addMessage', () => {
    it('should add a user message to conversation', async () => {
      const sessionId = 'test-session-123';
      const messageOptions = {
        role: 'user' as const,
        content: 'Hello, how are you?',
      };

      const message = await service.addMessage(sessionId, messageOptions);

      expect(message).toBeDefined();
      expect(message.role).toBe('user');
      expect(message.content).toBe(messageOptions.content);
      expect(message.timestamp).toBeDefined();

      // Verify Redis ZADD call
      expect(mockRedisClient.zadd).toHaveBeenCalledWith(
        CHAT_REDIS_KEYS.MESSAGES(sessionId),
        expect.any(Number),
        expect.any(String),
      );
      expect(mockRedisClient.expire).toHaveBeenCalledWith(
        CHAT_REDIS_KEYS.MESSAGES(sessionId),
        CHAT_TTL_CONFIG.MESSAGE_TTL,
      );
    });

    it('should add a voice message with metadata', async () => {
      const sessionId = 'test-session-123';
      const messageOptions = {
        role: 'user' as const,
        content: 'Hello from voice',
        isVoice: true,
        voiceMetadata: {
          confidence: 0.95,
          language: 'en-US',
          duration: 3500,
        },
      };

      const message = await service.addMessage(sessionId, messageOptions);

      expect(message.isVoice).toBe(true);
      expect(message.confidence).toBe(0.95);
      expect(message.language).toBe('en-US');
      expect(message.duration).toBe(3500);
    });
  });

  describe('getConversation', () => {
    it('should retrieve conversation from Redis', async () => {
      const sessionId = 'test-session-123';
      const mockConversation = {
        sessionId,
        workflowId: 'workflow-123',
        workspaceId: 'workspace-123',
        participants: [],
        status: 'active',
        createdAt: Date.now(),
        lastActivity: Date.now(),
      };

      redisService.get.mockResolvedValue(JSON.stringify(mockConversation));

      const conversation = await service.getConversation(sessionId);

      expect(conversation).toEqual(mockConversation);
      expect(redisService.get).toHaveBeenCalledWith(
        CHAT_REDIS_KEYS.CONVERSATION(sessionId),
      );
    });

    it('should return null if conversation not found', async () => {
      redisService.get.mockResolvedValue(null);

      const conversation = await service.getConversation('non-existent');

      expect(conversation).toBeNull();
    });
  });

  describe('getHistory', () => {
    it('should retrieve message history in chronological order', async () => {
      const sessionId = 'test-session-123';
      const mockMessages = [
        { role: 'user', content: 'Hello', timestamp: 1000 },
        { role: 'assistant', content: 'Hi there!', timestamp: 2000 },
      ];

      mockRedisClient.zrange.mockResolvedValue(
        mockMessages.map((msg) => JSON.stringify(msg)),
      );

      const history = await service.getHistory(sessionId, { limit: 10 });

      expect(history).toHaveLength(2);
      expect(history[0].content).toBe('Hello');
      expect(history[1].content).toBe('Hi there!');
      expect(mockRedisClient.zrange).toHaveBeenCalledWith(
        CHAT_REDIS_KEYS.MESSAGES(sessionId),
        0,
        9,
      );
    });

    it('should filter out system messages when includeSystem is false', async () => {
      const sessionId = 'test-session-123';
      const mockMessages = [
        { role: 'user', content: 'Hello', timestamp: 1000 },
        { role: 'system', content: 'System message', timestamp: 1500 },
        { role: 'assistant', content: 'Hi there!', timestamp: 2000 },
      ];

      mockRedisClient.zrange.mockResolvedValue(
        mockMessages.map((msg) => JSON.stringify(msg)),
      );

      const history = await service.getHistory(sessionId, {
        limit: 10,
        includeSystem: false,
      });

      expect(history).toHaveLength(2);
      expect(history.find((msg) => msg.role === 'system')).toBeUndefined();
    });
  });

  describe('getConversationContext', () => {
    it('should build complete conversation context', async () => {
      const sessionId = 'test-session-123';
      const mockConversation = {
        sessionId,
        workflowId: 'workflow-123',
        workspaceId: 'workspace-123',
        participants: [],
        status: 'active' as const,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        context: {
          systemPrompt: 'You are helpful',
          systemMessage: 'Hello!',
        },
      };

      const mockMessages = [
        { role: 'user', content: 'Hello', timestamp: 1000 },
        { role: 'assistant', content: 'Hi there!', timestamp: 2000 },
      ];

      redisService.get.mockResolvedValue(JSON.stringify(mockConversation));
      mockRedisClient.zrange.mockResolvedValue(
        mockMessages.map((msg) => JSON.stringify(msg)),
      );

      const context = await service.getConversationContext(
        sessionId,
        'test query',
      );

      expect(context).toBeDefined();
      expect(context.systemPrompt).toBe('You are helpful');
      expect(context.systemMessage).toBe('Hello!');
      expect(context.conversationHistory).toHaveLength(2);
      expect(context.ragContext).toBeDefined();
      expect(ragContextService.getRagContext).toHaveBeenCalledWith('test query');
    });

    it('should throw NotFoundException if conversation not found', async () => {
      redisService.get.mockResolvedValue(null);

      await expect(
        service.getConversationContext('non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('should update conversation status', async () => {
      const sessionId = 'test-session-123';
      const mockConversation = {
        sessionId,
        workflowId: 'workflow-123',
        workspaceId: 'workspace-123',
        participants: [],
        status: 'active' as const,
        createdAt: Date.now(),
        lastActivity: Date.now(),
      };

      redisService.get.mockResolvedValue(JSON.stringify(mockConversation));
      redisService.set.mockResolvedValue(true);

      await service.updateStatus(sessionId, 'ended');

      expect(redisService.set).toHaveBeenCalledWith(
        CHAT_REDIS_KEYS.CONVERSATION(sessionId),
        expect.stringContaining('"status":"ended"'),
        CHAT_TTL_CONFIG.CONVERSATION_TTL,
      );
    });
  });

  describe('deleteConversation', () => {
    it('should delete conversation and all associated data', async () => {
      const sessionId = 'test-session-123';

      redisService.del.mockResolvedValue(true);

      await service.deleteConversation(sessionId);

      expect(redisService.del).toHaveBeenCalledWith(
        CHAT_REDIS_KEYS.CONVERSATION(sessionId),
      );
      expect(redisService.del).toHaveBeenCalledWith(
        CHAT_REDIS_KEYS.MESSAGES(sessionId),
      );
      expect(mockRedisClient.srem).toHaveBeenCalledWith(
        CHAT_REDIS_KEYS.ACTIVE_SESSIONS,
        sessionId,
      );
    });
  });

  describe('getActiveSessions', () => {
    it('should retrieve all active sessions', async () => {
      const mockSessions = ['session-1', 'session-2', 'session-3'];
      mockRedisClient.smembers.mockResolvedValue(mockSessions);

      const sessions = await service.getActiveSessions();

      expect(sessions).toEqual(mockSessions);
      expect(mockRedisClient.smembers).toHaveBeenCalledWith(
        CHAT_REDIS_KEYS.ACTIVE_SESSIONS,
      );
    });
  });
});
