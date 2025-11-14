import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WebhookDeliveryProcessor } from '../webhook-delivery.processor';
import { WebhookCacheService } from '@jibu/cache-utils';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('WebhookDeliveryProcessor', () => {
  let processor: WebhookDeliveryProcessor;
  let mockCacheService: jest.Mocked<WebhookCacheService>;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    mockCacheService = {
      getWebhookUrl: jest.fn(),
    } as any;

    mockConfigService = {
      get: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookDeliveryProcessor,
        {
          provide: WebhookCacheService,
          useValue: mockCacheService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    processor = module.get<WebhookDeliveryProcessor>(WebhookDeliveryProcessor);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handle', () => {
    it('should deliver webhook successfully for non-voice workflow', async () => {
      const job = {
        id: 'job-123',
        data: {
          workflowId: 'workflow-123',
          sessionId: 'session-456',
          payload: { text: 'Hello world' },
          isVoice: false,
          priority: 1,
        },
        attemptsMade: 0,
      } as any;

      const webhookUrl = 'https://n8n.example.com/webhook/123';
      mockCacheService.getWebhookUrl.mockResolvedValue(webhookUrl);
      mockedAxios.post.mockResolvedValue({
        data: { success: true },
        status: 200,
      });

      const result = await processor.handle(job);

      expect(result.success).toBe(true);
      expect(mockCacheService.getWebhookUrl).toHaveBeenCalledWith('workflow-123', false);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        webhookUrl,
        job.data.payload,
        expect.objectContaining({
          timeout: 10000, // 10s for non-voice
          headers: expect.objectContaining({
            'X-Jibu-Voice': 'false',
          }),
        })
      );
    });

    it('should deliver webhook successfully for voice workflow', async () => {
      const job = {
        id: 'job-456',
        data: {
          workflowId: 'workflow-456',
          sessionId: 'session-789',
          payload: { type: 'user_message', text: 'Hello' },
          isVoice: true,
          connectionId: 'conn-123',
          priority: 10,
        },
        attemptsMade: 0,
      } as any;

      const webhookUrl = 'https://n8n.example.com/webhook/456';
      mockCacheService.getWebhookUrl.mockResolvedValue(webhookUrl);
      mockedAxios.post.mockResolvedValue({
        data: { success: true },
        status: 200,
      });

      const result = await processor.handle(job);

      expect(result.success).toBe(true);
      expect(mockCacheService.getWebhookUrl).toHaveBeenCalledWith('workflow-456', true);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        webhookUrl,
        job.data.payload,
        expect.objectContaining({
          timeout: 5000, // 5s for voice
          headers: expect.objectContaining({
            'X-Jibu-Voice': 'true',
          }),
        })
      );
    });

    it('should return fallback message when webhook URL not found for voice workflow', async () => {
      const job = {
        id: 'job-789',
        data: {
          workflowId: 'workflow-789',
          sessionId: 'session-012',
          payload: { type: 'user_message', text: 'Hello' },
          isVoice: true,
          priority: 10,
        },
        attemptsMade: 0,
      } as any;

      mockCacheService.getWebhookUrl.mockResolvedValue(null);

      const result = await processor.handle(job);

      expect(result.fallback).toBe(true);
      expect(result.message).toBe("I apologize, but I'm experiencing technical difficulties. Please try again.");
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('should throw error when webhook URL not found for non-voice workflow', async () => {
      const job = {
        id: 'job-012',
        data: {
          workflowId: 'workflow-012',
          sessionId: 'session-345',
          payload: { text: 'Hello' },
          isVoice: false,
          priority: 1,
        },
        attemptsMade: 0,
      } as any;

      mockCacheService.getWebhookUrl.mockResolvedValue(null);

      await expect(processor.handle(job)).rejects.toThrow('No webhook URL found for workflow workflow-012');
    });

    it('should trigger circuit breaker after threshold failures', async () => {
      const job = {
        id: 'job-345',
        data: {
          workflowId: 'workflow-345',
          sessionId: 'session-678',
          payload: { type: 'user_message', text: 'Hello' },
          isVoice: true,
          priority: 10,
        },
        attemptsMade: 0,
      } as any;

      const webhookUrl = 'https://n8n.example.com/webhook/345';
      mockCacheService.getWebhookUrl.mockResolvedValue(webhookUrl);

      // Simulate 3 failures
      for (let i = 0; i < 3; i++) {
        mockedAxios.post.mockRejectedValueOnce(new Error('Network error'));
        try {
          await processor.handle(job);
        } catch (error) {
          // Expected to fail
        }
      }

      // 4th attempt should trigger circuit breaker
      const result = await processor.handle(job);

      expect(result.fallback).toBe(true);
      expect(result.message).toBe("I apologize, but I'm experiencing technical difficulties. Please try again.");
    });

    it('should return fallback after max retries for voice workflow', async () => {
      const job = {
        id: 'job-678',
        data: {
          workflowId: 'workflow-678',
          sessionId: 'session-901',
          payload: { type: 'user_message', text: 'Hello' },
          isVoice: true,
          priority: 10,
        },
        attemptsMade: 2, // Max retries reached
      } as any;

      const webhookUrl = 'https://n8n.example.com/webhook/678';
      mockCacheService.getWebhookUrl.mockResolvedValue(webhookUrl);
      mockedAxios.post.mockRejectedValue(new Error('Network error'));

      const result = await processor.handle(job);

      expect(result.fallback).toBe(true);
      expect(result.message).toBe("I apologize, but I'm experiencing technical difficulties. Please try again.");
    });

    it('should handle timeout errors', async () => {
      const job = {
        id: 'job-901',
        data: {
          workflowId: 'workflow-901',
          sessionId: 'session-234',
          payload: { text: 'Hello' },
          isVoice: false,
          priority: 1,
        },
        attemptsMade: 0,
      } as any;

      const webhookUrl = 'https://n8n.example.com/webhook/901';
      mockCacheService.getWebhookUrl.mockResolvedValue(webhookUrl);
      mockedAxios.post.mockRejectedValue({
        code: 'ECONNABORTED',
        message: 'timeout of 10000ms exceeded',
      });

      await expect(processor.handle(job)).rejects.toThrow('Webhook delivery timeout after 5000ms');
    });

    it('should handle HTTP error responses', async () => {
      const job = {
        id: 'job-234',
        data: {
          workflowId: 'workflow-234',
          sessionId: 'session-567',
          payload: { text: 'Hello' },
          isVoice: false,
          priority: 1,
        },
        attemptsMade: 0,
      } as any;

      const webhookUrl = 'https://n8n.example.com/webhook/234';
      mockCacheService.getWebhookUrl.mockResolvedValue(webhookUrl);
      mockedAxios.post.mockRejectedValue({
        response: {
          status: 500,
          statusText: 'Internal Server Error',
        },
      });

      await expect(processor.handle(job)).rejects.toThrow('Webhook returned error status 500: Internal Server Error');
    });

    it('should handle network errors', async () => {
      const job = {
        id: 'job-567',
        data: {
          workflowId: 'workflow-567',
          sessionId: 'session-890',
          payload: { text: 'Hello' },
          isVoice: false,
          priority: 1,
        },
        attemptsMade: 0,
      } as any;

      const webhookUrl = 'https://n8n.example.com/webhook/567';
      mockCacheService.getWebhookUrl.mockResolvedValue(webhookUrl);
      mockedAxios.post.mockRejectedValue({
        request: {},
        message: 'Network Error',
      });

      await expect(processor.handle(job)).rejects.toThrow('No response received from webhook: Network Error');
    });

    it('should track delivery metrics', async () => {
      const job = {
        id: 'job-890',
        data: {
          workflowId: 'workflow-890',
          sessionId: 'session-123',
          payload: { text: 'Hello' },
          isVoice: false,
          priority: 1,
        },
        attemptsMade: 0,
      } as any;

      const webhookUrl = 'https://n8n.example.com/webhook/890';
      mockCacheService.getWebhookUrl.mockResolvedValue(webhookUrl);
      mockedAxios.post.mockResolvedValue({
        data: { success: true },
        status: 200,
      });

      const result = await processor.handle(job);

      expect(result.success).toBe(true);
      expect(result.deliveryTime).toBeDefined();
      expect(result.totalTime).toBeDefined();
      expect(typeof result.deliveryTime).toBe('number');
      expect(typeof result.totalTime).toBe('number');
    });

    it('should reset circuit breaker on successful delivery', async () => {
      const job = {
        id: 'job-reset',
        data: {
          workflowId: 'workflow-reset',
          sessionId: 'session-reset',
          payload: { text: 'Hello' },
          isVoice: false,
          priority: 1,
        },
        attemptsMade: 0,
      } as any;

      const webhookUrl = 'https://n8n.example.com/webhook/reset';
      mockCacheService.getWebhookUrl.mockResolvedValue(webhookUrl);

      // First, simulate a failure
      mockedAxios.post.mockRejectedValueOnce(new Error('Network error'));
      try {
        await processor.handle(job);
      } catch (error) {
        // Expected to fail
      }

      // Then, simulate a success
      mockedAxios.post.mockResolvedValue({
        data: { success: true },
        status: 200,
      });

      const result = await processor.handle(job);

      expect(result.success).toBe(true);
      
      // Circuit breaker should be reset, so another failure won't immediately trigger it
      mockedAxios.post.mockRejectedValueOnce(new Error('Network error'));
      try {
        await processor.handle(job);
      } catch (error) {
        // Expected to fail, but should not trigger circuit breaker yet
      }
    });
  });

  describe('onModuleInit', () => {
    it('should initialize and log processor name', () => {
      const logSpy = jest.spyOn(processor['logger'], 'log');
      
      processor.onModuleInit();

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('WebhookDeliveryProcessor initialized'));
    });
  });

  describe('onActive', () => {
    it('should log when job becomes active', () => {
      const debugSpy = jest.spyOn(processor['logger'], 'debug');
      const job = {
        id: 'job-active',
        data: {
          workflowId: 'workflow-active',
          sessionId: 'session-active',
          isVoice: true,
        },
      } as any;

      processor.onActive(job);

      expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('Job job-active active'));
    });
  });

  describe('onCompleted', () => {
    it('should log when job completes', () => {
      const logSpy = jest.spyOn(processor['logger'], 'log');
      const job = {
        id: 'job-completed',
        data: {
          workflowId: 'workflow-completed',
          isVoice: false,
        },
      } as any;

      processor.onCompleted(job, { success: true });

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Job job-completed completed'));
    });
  });

  describe('onFailed', () => {
    it('should log when job fails', () => {
      const errorSpy = jest.spyOn(processor['logger'], 'error');
      const job = {
        id: 'job-failed',
        data: {
          workflowId: 'workflow-failed',
          sessionId: 'session-failed',
          isVoice: true,
        },
      } as any;
      const error = new Error('Test error');

      processor.onFailed(job, error);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Job job-failed failed'),
        expect.any(String)
      );
    });
  });
});
