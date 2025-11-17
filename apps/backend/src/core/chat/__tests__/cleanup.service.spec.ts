import { Test, TestingModule } from '@nestjs/testing';
import { ChatCleanupService } from '../cleanup.service';
import { ChatService } from '../chat.service';
import { CHAT_TTL_CONFIG } from '../chat.interfaces';

describe('ChatCleanupService', () => {
  let service: ChatCleanupService;
  let chatService: jest.Mocked<ChatService>;

  beforeEach(async () => {
    const mockChatService = {
      getActiveSessions: jest.fn(),
      getConversation: jest.fn(),
      removeFromActiveSessions: jest.fn(),
      deleteConversation: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatCleanupService,
        { provide: ChatService, useValue: mockChatService },
      ],
    }).compile();

    service = module.get<ChatCleanupService>(ChatCleanupService);
    chatService = module.get(ChatService) as jest.Mocked<ChatService>;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('cleanupInactiveSessions', () => {
    it('should cleanup inactive conversations', async () => {
      const now = Date.now();
      const inactiveThreshold = now - CHAT_TTL_CONFIG.INACTIVE_TIMEOUT;

      const mockSessions = ['session-1', 'session-2', 'session-3'];
      const mockConversations = [
        {
          sessionId: 'session-1',
          workflowId: 'workflow-1',
          workspaceId: 'workspace-1',
          participants: [],
          status: 'active' as const,
          createdAt: now - 7200000, // 2 hours ago
          lastActivity: inactiveThreshold - 1000, // Inactive
        },
        {
          sessionId: 'session-2',
          workflowId: 'workflow-2',
          workspaceId: 'workspace-2',
          participants: [],
          status: 'active' as const,
          createdAt: now - 1800000, // 30 minutes ago
          lastActivity: now - 600000, // Active (10 minutes ago)
        },
        null, // session-3 doesn't exist
      ];

      chatService.getActiveSessions.mockResolvedValue(mockSessions);
      chatService.getConversation
        .mockResolvedValueOnce(mockConversations[0])
        .mockResolvedValueOnce(mockConversations[1])
        .mockResolvedValueOnce(mockConversations[2]);

      await service.cleanupInactiveSessions();

      // Should delete session-1 (inactive) and remove session-3 (non-existent)
      expect(chatService.deleteConversation).toHaveBeenCalledWith('session-1');
      expect(chatService.removeFromActiveSessions).toHaveBeenCalledWith('session-3');
      
      // Should not delete session-2 (active)
      expect(chatService.deleteConversation).not.toHaveBeenCalledWith('session-2');
    });

    it('should handle empty active sessions', async () => {
      chatService.getActiveSessions.mockResolvedValue([]);

      await service.cleanupInactiveSessions();

      expect(chatService.getConversation).not.toHaveBeenCalled();
      expect(chatService.deleteConversation).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const mockSessions = ['session-1', 'session-2'];
      chatService.getActiveSessions.mockResolvedValue(mockSessions);
      chatService.getConversation
        .mockRejectedValueOnce(new Error('Redis error'))
        .mockResolvedValueOnce(null);

      // Should not throw
      await expect(service.cleanupInactiveSessions()).resolves.not.toThrow();

      // Should still process session-2
      expect(chatService.removeFromActiveSessions).toHaveBeenCalledWith('session-2');
    });

    it('should prevent concurrent cleanup runs', async () => {
      chatService.getActiveSessions.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 100)),
      );

      // Start first cleanup
      const firstCleanup = service.cleanupInactiveSessions();
      
      // Try to start second cleanup immediately
      const secondCleanup = service.cleanupInactiveSessions();

      await Promise.all([firstCleanup, secondCleanup]);

      // Should only call getActiveSessions once
      expect(chatService.getActiveSessions).toHaveBeenCalledTimes(1);
    });
  });

  describe('triggerCleanup', () => {
    it('should return cleanup statistics', async () => {
      const now = Date.now();
      const inactiveThreshold = now - CHAT_TTL_CONFIG.INACTIVE_TIMEOUT;

      const mockSessions = ['session-1', 'session-2'];
      const mockConversations = [
        {
          sessionId: 'session-1',
          workflowId: 'workflow-1',
          workspaceId: 'workspace-1',
          participants: [],
          status: 'active' as const,
          createdAt: now - 7200000,
          lastActivity: inactiveThreshold - 1000, // Inactive
        },
        {
          sessionId: 'session-2',
          workflowId: 'workflow-2',
          workspaceId: 'workspace-2',
          participants: [],
          status: 'active' as const,
          createdAt: now - 1800000,
          lastActivity: now - 600000, // Active
        },
      ];

      chatService.getActiveSessions.mockResolvedValue(mockSessions);
      chatService.getConversation
        .mockResolvedValueOnce(mockConversations[0])
        .mockResolvedValueOnce(mockConversations[1]);

      const result = await service.triggerCleanup();

      expect(result.success).toBe(true);
      expect(result.cleaned).toBe(1);
      expect(result.errors).toBe(0);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should handle cleanup failures', async () => {
      chatService.getActiveSessions.mockRejectedValue(new Error('Redis error'));

      const result = await service.triggerCleanup();

      expect(result.success).toBe(false);
      expect(result.cleaned).toBe(0);
      expect(result.errors).toBe(1);
    });
  });

  describe('getCleanupStats', () => {
    it('should return cleanup statistics', async () => {
      const now = Date.now();
      const inactiveThreshold = now - CHAT_TTL_CONFIG.INACTIVE_TIMEOUT;

      const mockSessions = ['session-1', 'session-2', 'session-3'];
      const mockConversations = [
        {
          sessionId: 'session-1',
          workflowId: 'workflow-1',
          workspaceId: 'workspace-1',
          participants: [],
          status: 'active' as const,
          createdAt: now - 7200000,
          lastActivity: inactiveThreshold - 1000, // Inactive
        },
        {
          sessionId: 'session-2',
          workflowId: 'workflow-2',
          workspaceId: 'workspace-2',
          participants: [],
          status: 'active' as const,
          createdAt: now - 1800000,
          lastActivity: now - 600000, // Active
        },
        null, // Non-existent
      ];

      chatService.getActiveSessions.mockResolvedValue(mockSessions);
      chatService.getConversation
        .mockResolvedValueOnce(mockConversations[0])
        .mockResolvedValueOnce(mockConversations[1])
        .mockResolvedValueOnce(mockConversations[2]);

      const stats = await service.getCleanupStats();

      expect(stats.activeSessions).toBe(1); // Only session-2
      expect(stats.inactiveSessions).toBe(2); // session-1 and session-3
      expect(stats.oldestActivity).toBeDefined();
      expect(stats.newestActivity).toBeDefined();
    });

    it('should handle errors gracefully', async () => {
      chatService.getActiveSessions.mockRejectedValue(new Error('Redis error'));

      const stats = await service.getCleanupStats();

      expect(stats.activeSessions).toBe(0);
      expect(stats.inactiveSessions).toBe(0);
      expect(stats.oldestActivity).toBeNull();
      expect(stats.newestActivity).toBeNull();
    });
  });
});
