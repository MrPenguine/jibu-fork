import { Test, TestingModule } from '@nestjs/testing';
import { AgentService } from '../services/agent.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { getQueueToken } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { WorkflowService } from '../../workflow/services/workflow.service';
import { N8nIntegrationService } from '../../../../integrations/n8n/n8n-integration.service';
import { v4 as uuidv4 } from 'uuid';

describe('Agent N8N Workflow Synchronization', () => {
  let agentService: AgentService;
  let prismaService: PrismaService;
  let n8nService: N8nIntegrationService;
  let workflowService: WorkflowService;

  // Mock agent data
  const mockAgent = {
    id: uuidv4(),
    name: 'Test Agent',
    description: 'Test agent for N8N sync',
    assistantId: 'asst_123456',
    organizationId: 'org_123456',
    metadata: {},
    update: jest.fn().mockImplementation(async (data) => ({ ...mockAgent, ...data }))
  };

  // Mock workflow data with nodes and edges
  const mockWorkflow = {
    id: uuidv4(),
    name: 'Primary Workflow',
    agentId: mockAgent.id,
    nodes: {
      node1: { id: 'node1', type: 'START', position: { x: 100, y: 100 }, data: {} },
      node2: { 
        id: 'node2', 
        type: 'ASSISTANT', 
        position: { x: 300, y: 100 }, 
        data: { 
          systemPrompt: 'You are a helpful assistant',
          model: 'gemini-pro',
          temperature: 0.5
        } 
      },
      node3: { id: 'node3', type: 'END', position: { x: 500, y: 100 }, data: {} }
    },
    edges: {
      edge1: { id: 'edge1', source: 'node1', target: 'node2' },
      edge2: { id: 'edge2', source: 'node2', target: 'node3' }
    }
  };

  // Mock N8N workflow response
  const mockN8nWorkflowResponse = {
    workflow: {
      id: 'n8n_workflow_id',
      name: 'Test Agent Workflow',
      active: false,
      nodes: [],
      connections: { main: [] }
    },
    webhookUrl: 'https://n8n.example.com/webhook/abc123',
    webhookId: 'abc123'
  };

  // Mock implementation
  const mockPrismaService = {
    agent: {
      findUnique: jest.fn().mockImplementation(async () => mockAgent),
      update: jest.fn().mockImplementation(async (data) => ({ ...mockAgent, ...data.data }))
    },
    workflow: {
      findFirst: jest.fn().mockImplementation(async () => mockWorkflow),
      findMany: jest.fn().mockImplementation(async () => [mockWorkflow])
    }
  };

  const mockN8nService = {
    createWebhookWorkflow: jest.fn().mockImplementation(async () => mockN8nWorkflowResponse)
  };

  const mockWorkflowService = {
    getPrimaryWorkflow: jest.fn().mockImplementation(async () => ({
      nodes: mockWorkflow.nodes,
      edges: mockWorkflow.edges
    }))
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentService,
        {
          provide: PrismaService,
          useValue: mockPrismaService
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn() }
        },
        {
          provide: CACHE_MANAGER,
          useValue: { get: jest.fn(), set: jest.fn() }
        },
        {
          provide: getQueueToken('agents'),
          useValue: { add: jest.fn() }
        },
        {
          provide: Logger,
          useValue: { log: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() }
        },
        {
          provide: WorkflowService,
          useValue: mockWorkflowService
        },
        {
          provide: N8nIntegrationService,
          useValue: mockN8nService
        }
      ],
    }).compile();

    agentService = module.get<AgentService>(AgentService);
    prismaService = module.get<PrismaService>(PrismaService);
    n8nService = module.get<N8nIntegrationService>(N8nIntegrationService);
    workflowService = module.get<WorkflowService>(WorkflowService);
  });

  it('should create N8N workflow when publishing an agent', async () => {
    // Act
    await agentService.publish(mockAgent.id, mockAgent.organizationId);

    // Assert
    // Should call N8nIntegrationService.createWebhookWorkflow
    expect(n8nService.createWebhookWorkflow).toHaveBeenCalled();
    
    // Should update agent with N8N workflow metadata
    expect(prismaService.agent.update).toHaveBeenCalledWith({
      where: { id: mockAgent.id },
      data: expect.objectContaining({
        metadata: expect.objectContaining({
          n8n: expect.objectContaining({
            workflowId: mockN8nWorkflowResponse.workflow.id,
            webhookUrl: mockN8nWorkflowResponse.webhookUrl,
            lastSynced: expect.any(String)
          })
        })
      })
    });
  });

  it('should handle N8N workflow creation failure gracefully', async () => {
    // Setup
    const error = new Error('N8N API error');
    n8nService.createWebhookWorkflow.mockRejectedValueOnce(error);

    // Act
    await agentService.publish(mockAgent.id, mockAgent.organizationId);

    // Assert
    // Should still update agent as published even if N8N sync fails
    expect(prismaService.agent.update).toHaveBeenCalledWith({
      where: { id: mockAgent.id },
      data: expect.objectContaining({
        metadata: expect.objectContaining({
          n8n: expect.objectContaining({
            error: expect.stringContaining('N8N API error'),
            errorTimestamp: expect.any(String)
          })
        })
      })
    });
  });
});
