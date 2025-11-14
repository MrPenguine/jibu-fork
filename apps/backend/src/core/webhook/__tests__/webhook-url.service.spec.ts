import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WebhookUrlService } from '../webhook-url.service';
import { PrismaService } from '../../database/prisma.service';
import { WebhookCacheService } from '@jibu/cache-utils';

describe('WebhookUrlService', () => {
  let service: WebhookUrlService;
  // Use lenient typings for mocks to avoid Prisma type friction in tests
  let prisma: any;
  let cacheService: any;
  let configService: any;

  beforeEach(async () => {
    const mockPrisma = {
      workflow: {
        findUnique: jest.fn(),
      },
      n8nWorkflow: {
        update: jest.fn(),
      },
    };

    const mockCache = {
      getWebhookUrl: jest.fn(),
      setWebhookUrl: jest.fn(),
      invalidate: jest.fn(),
      resetCircuitBreaker: jest.fn(),
    };

    const mockConfig = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookUrlService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: WebhookCacheService, useValue: mockCache },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<WebhookUrlService>(WebhookUrlService);
    prisma = module.get(PrismaService) as any;
    cacheService = module.get(WebhookCacheService) as any;
    configService = module.get(ConfigService) as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getWebhookUrl', () => {
    it('should return cached URL on cache hit', async () => {
      const workflowId = 'workflow-1';
      const url = 'https://n8n.example.com/webhook/test';

      cacheService.getWebhookUrl.mockResolvedValue(url);

      const result = await service.getWebhookUrl(workflowId, false);

      expect(result).toBe(url);
      expect(cacheService.getWebhookUrl).toHaveBeenCalledWith(workflowId, false);
      expect(prisma.workflow.findUnique).not.toHaveBeenCalled();
    });

    it('should query database on cache miss and populate cache', async () => {
      const workflowId = 'workflow-2';
      const url = 'https://n8n.example.com/webhook/test2';

      cacheService.getWebhookUrl.mockResolvedValue(null);
      prisma.workflow.findUnique.mockResolvedValue({
        id: workflowId,
        n8nWorkflow: {
          webhookUrl: url,
        },
      } as any);

      const result = await service.getWebhookUrl(workflowId, false);

      expect(result).toBe(url);
      expect(prisma.workflow.findUnique).toHaveBeenCalledWith({
        where: { id: workflowId },
        include: { n8nWorkflow: true },
      });
      expect(cacheService.setWebhookUrl).toHaveBeenCalledWith(workflowId, url, false);
    });

    it('should return null if workflow not found', async () => {
      const workflowId = 'missing-workflow';

      cacheService.getWebhookUrl.mockResolvedValue(null);
      prisma.workflow.findUnique.mockResolvedValue(null);

      const result = await service.getWebhookUrl(workflowId, false);

      expect(result).toBeNull();
    });
  });

  describe('refreshWebhookUrl', () => {
    it('should refresh webhook URL from workflow JSON', async () => {
      const workflowId = 'workflow-3';
      const webhookPath = 'test-path';
      const baseUrl = 'https://n8n.example.com';

      configService.get.mockReturnValue(baseUrl);

      prisma.workflow.findUnique.mockResolvedValue({
        id: workflowId,
        n8nWorkflow: {
          id: 'n8n-1',
          n8nWorkflowId: 'n8n-workflow-1',
          workflowJson: {
            nodes: [
              {
                type: 'n8n-nodes-base.webhook',
                parameters: { path: webhookPath },
              },
            ],
          },
        },
        agent: null,
      } as any);

      prisma.n8nWorkflow.update.mockResolvedValue({} as any);

      const result = await service.refreshWebhookUrl(workflowId);

      expect(result).toBe(`${baseUrl}/webhook/${webhookPath}`);
      expect(prisma.n8nWorkflow.update).toHaveBeenCalled();
      expect(cacheService.invalidate).toHaveBeenCalledWith(workflowId);
      expect(cacheService.resetCircuitBreaker).toHaveBeenCalledWith(workflowId);
    });

    it('should return null if workflow has no n8n workflow', async () => {
      const workflowId = 'workflow-4';

      prisma.workflow.findUnique.mockResolvedValue({
        id: workflowId,
        n8nWorkflow: null,
      } as any);

      const result = await service.refreshWebhookUrl(workflowId);

      expect(result).toBeNull();
    });

    it('should return null if workflow has no published version', async () => {
      const workflowId = 'workflow-5';

      prisma.workflow.findUnique.mockResolvedValue({
        id: workflowId,
        n8nWorkflow: {
          id: 'n8n-2',
          n8nWorkflowId: null, // No published version
        },
      } as any);

      const result = await service.refreshWebhookUrl(workflowId);

      expect(result).toBeNull();
    });
  });

  describe('resolveBaseUrl', () => {
    it('should prioritize N8N_WEBHOOK_URL', () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'N8N_WEBHOOK_URL') return 'https://webhook.example.com';
        if (key === 'N8N_PUBLIC_URL') return 'https://public.example.com';
        if (key === 'N8N_API_URL') return 'https://api.example.com';
        return undefined;
      });

      const result = service.resolveBaseUrl();

      expect(result).toBe('https://webhook.example.com');
    });

    it('should fall back to N8N_PUBLIC_URL', () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'N8N_WEBHOOK_URL') return undefined;
        if (key === 'N8N_PUBLIC_URL') return 'https://public.example.com';
        if (key === 'N8N_API_URL') return 'https://api.example.com';
        return undefined;
      });

      const result = service.resolveBaseUrl();

      expect(result).toBe('https://public.example.com');
    });

    it('should strip /api/v1 from N8N_API_URL', () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'N8N_WEBHOOK_URL') return undefined;
        if (key === 'N8N_PUBLIC_URL') return undefined;
        if (key === 'N8N_API_URL') return 'https://api.example.com/api/v1';
        return undefined;
      });

      const result = service.resolveBaseUrl();

      expect(result).toBe('https://api.example.com');
    });
  });

  describe('needsRefresh', () => {
    it('should return true if webhook URL is old', async () => {
      const workflowId = 'workflow-6';
      const oldDate = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago

      prisma.workflow.findUnique.mockResolvedValue({
        id: workflowId,
        n8nWorkflow: {
          webhookUrl: 'https://n8n.example.com/webhook/old',
          lastValidatedAt: oldDate,
        },
      } as any);

      const result = await service.needsRefresh(workflowId, 60);

      expect(result).toBe(true);
    });

    it('should return false if webhook URL is fresh', async () => {
      const workflowId = 'workflow-7';
      const recentDate = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago

      prisma.workflow.findUnique.mockResolvedValue({
        id: workflowId,
        n8nWorkflow: {
          webhookUrl: 'https://n8n.example.com/webhook/fresh',
          lastValidatedAt: recentDate,
        },
      } as any);

      const result = await service.needsRefresh(workflowId, 60);

      expect(result).toBe(false);
    });

    it('should return true if no webhook URL exists', async () => {
      const workflowId = 'workflow-8';

      prisma.workflow.findUnique.mockResolvedValue({
        id: workflowId,
        n8nWorkflow: {
          webhookUrl: null,
        },
      } as any);

      const result = await service.needsRefresh(workflowId, 60);

      expect(result).toBe(true);
    });
  });

  describe('batchRefreshWebhookUrls', () => {
    it('should refresh multiple workflows', async () => {
      const workflowIds = ['workflow-1', 'workflow-2', 'workflow-3'];

      jest.spyOn(service, 'refreshWebhookUrl').mockResolvedValue('https://n8n.example.com/webhook/test');

      const results = await service.batchRefreshWebhookUrls(workflowIds);

      expect(results.size).toBe(3);
      expect(service.refreshWebhookUrl).toHaveBeenCalledTimes(3);
    });
  });
});
