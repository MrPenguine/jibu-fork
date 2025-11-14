import { Test, TestingModule } from '@nestjs/testing';
import { PublishWorkflowProcessor } from '../publish-workflow.processor';
import { PrismaService } from '../../../../backend/src/core/database/prisma.service';
import { N8nAdminClient } from '../n8n-admin.client';
import { WebhookCacheService } from '@jibu/cache-utils';

describe('PublishWorkflowProcessor', () => {
  let processor: PublishWorkflowProcessor;
  let prisma: jest.Mocked<PrismaService>;
  let webhookCache: jest.Mocked<WebhookCacheService>;

  beforeEach(async () => {
    const mockPrisma = {
      workflow: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      n8nWorkflow: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    const mockN8nAdmin = {
      workflowExists: jest.fn().mockResolvedValue(true),
      updateWorkflow: jest.fn().mockResolvedValue({ id: 'n8n-1' }),
      setActive: jest.fn().mockResolvedValue({}),
    };

    const mockWebhookCache = {
      invalidate: jest.fn(),
      setWebhookUrl: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublishWorkflowProcessor,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: N8nAdminClient, useValue: mockN8nAdmin },
        { provide: WebhookCacheService, useValue: mockWebhookCache },
      ],
    }).compile();

    processor = module.get<PublishWorkflowProcessor>(PublishWorkflowProcessor);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
    webhookCache = module.get(WebhookCacheService) as jest.Mocked<WebhookCacheService>;
  });

  it('should invalidate cache after successful publish', async () => {
    const job = {
      id: '1',
      data: {
        workflowId: 'workflow-1',
        workspaceId: 'workspace-1',
        activate: true,
      },
    };

    prisma.workflow.findFirst.mockResolvedValue({
      id: 'workflow-1',
      name: 'Test',
      n8nWorkflow: {
        id: 'n8n-1',
        workflowJson: {
          nodes: [{ type: 'n8n-nodes-base.webhook', parameters: { path: 'test' } }],
        },
      },
    } as any);

    prisma.n8nWorkflow.findFirst.mockResolvedValue({
      id: 'n8n-1',
      workflowJson: { nodes: [] },
    } as any);

    prisma.workflow.findUnique.mockResolvedValue({
      agent: { ttsProvider: 'OPENAI' },
    } as any);

    process.env.N8N_WEBHOOK_URL = 'https://n8n.example.com';

    await processor.handle(job as any);

    expect(webhookCache.invalidate).toHaveBeenCalledWith('workflow-1');
    expect(webhookCache.setWebhookUrl).toHaveBeenCalled();
  });
});
