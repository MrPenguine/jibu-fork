import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { ChatModule } from '../chat.module';
import { ChatService } from '../../../core/chat/chat.service';
import { MessageQueueService } from '../../../core/services/message-queue.service';

/**
 * Integration tests for chat system
 * Tests complete flow from conversation start to webhook delivery
 */
describe('Chat Integration Tests', () => {
  let app: INestApplication;
  let chatService: ChatService;
  let messageQueueService: MessageQueueService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ChatModule],
    })
      .overrideProvider(MessageQueueService)
      .useValue({
        sendMessageToWorkflow: jest.fn(),
        sendVoiceMessageToWorkflow: jest.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    chatService = moduleFixture.get<ChatService>(ChatService);
    messageQueueService = moduleFixture.get<MessageQueueService>(MessageQueueService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/chat/start', () => {
    it('should create a new conversation', async () => {
      const sessionId = `test-session-${Date.now()}`;
      const dto = {
        sessionId,
        workflowId: 'cf769a32-2140-420f-99ed-19abb22ee721',
        workspaceId: '85fb8ec7-e33c-43ce-bc20-7fa0ac55060b',
        userId: 'test-user-123',
        initialContext: {
          systemPrompt: 'You are a helpful assistant',
          systemMessage: 'Welcome!',
        },
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/chat/start')
        .send(dto)
        .expect(201);

      expect(response.body).toMatchObject({
        sessionId,
        workflowId: dto.workflowId,
        workspaceId: dto.workspaceId,
        status: 'active',
      });
      expect(response.body.participants).toHaveLength(2);
      expect(response.body.createdAt).toBeDefined();
      expect(response.body.lastActivity).toBeDefined();

      // Cleanup
      await chatService.deleteConversation(sessionId);
    });

    it('should reject invalid workflow ID', async () => {
      const dto = {
        sessionId: 'test-session',
        workflowId: 'invalid-uuid',
        workspaceId: '85fb8ec7-e33c-43ce-bc20-7fa0ac55060b',
      };

      await request(app.getHttpServer())
        .post('/api/v1/chat/start')
        .send(dto)
        .expect(400);
    });
  });

  describe('POST /api/v1/chat/message', () => {
    let sessionId: string;

    beforeEach(async () => {
      // Create a conversation for testing
      sessionId = `test-session-${Date.now()}`;
      await chatService.createConversation(sessionId, {
        workflowId: 'cf769a32-2140-420f-99ed-19abb22ee721',
        workspaceId: '85fb8ec7-e33c-43ce-bc20-7fa0ac55060b',
        initialContext: {
          systemPrompt: 'You are helpful',
          systemMessage: 'Hello!',
        },
      });
    });

    afterEach(async () => {
      // Cleanup
      await chatService.deleteConversation(sessionId);
    });

    it('should send a text message and enqueue webhook', async () => {
      const dto = {
        sessionId,
        text: 'Hello, I need help',
        isVoice: false,
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/chat/message')
        .send(dto)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toMatchObject({
        role: 'user',
        content: dto.text,
      });

      // Verify webhook was enqueued
      expect(messageQueueService.sendMessageToWorkflow).toHaveBeenCalledWith(
        'cf769a32-2140-420f-99ed-19abb22ee721',
        sessionId,
        dto.text,
        expect.objectContaining({
          systemPrompt: 'You are helpful',
          systemMessage: 'Hello!',
          conversationHistory: expect.any(Array),
          ragContext: expect.any(Object),
        }),
      );
    });

    it('should send a voice message with metadata', async () => {
      const dto = {
        sessionId,
        text: 'Hello from voice',
        isVoice: true,
        voiceMetadata: {
          confidence: 0.95,
          language: 'en-US',
          duration: 3500,
        },
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/chat/message')
        .send(dto)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message.isVoice).toBe(true);
      expect(response.body.message.confidence).toBe(0.95);

      // Verify voice webhook was enqueued
      expect(messageQueueService.sendVoiceMessageToWorkflow).toHaveBeenCalledWith(
        'cf769a32-2140-420f-99ed-19abb22ee721',
        sessionId,
        dto.text,
        dto.voiceMetadata,
        expect.any(Object),
      );
    });

    it('should reject voice message without metadata', async () => {
      const dto = {
        sessionId,
        text: 'Hello from voice',
        isVoice: true,
        // Missing voiceMetadata
      };

      await request(app.getHttpServer())
        .post('/api/v1/chat/message')
        .send(dto)
        .expect(400);
    });

    it('should return 404 for non-existent conversation', async () => {
      const dto = {
        sessionId: 'non-existent-session',
        text: 'Hello',
      };

      await request(app.getHttpServer())
        .post('/api/v1/chat/message')
        .send(dto)
        .expect(404);
    });
  });

  describe('GET /api/v1/chat/history/:sessionId', () => {
    let sessionId: string;

    beforeEach(async () => {
      // Create a conversation with messages
      sessionId = `test-session-${Date.now()}`;
      await chatService.createConversation(sessionId, {
        workflowId: 'cf769a32-2140-420f-99ed-19abb22ee721',
        workspaceId: '85fb8ec7-e33c-43ce-bc20-7fa0ac55060b',
      });

      // Add some messages
      await chatService.addMessage(sessionId, {
        role: 'user',
        content: 'Hello',
      });
      await chatService.addMessage(sessionId, {
        role: 'assistant',
        content: 'Hi there!',
      });
      await chatService.addMessage(sessionId, {
        role: 'user',
        content: 'How are you?',
      });
    });

    afterEach(async () => {
      await chatService.deleteConversation(sessionId);
    });

    it('should retrieve conversation history', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/chat/history/${sessionId}`)
        .expect(200);

      expect(response.body.sessionId).toBe(sessionId);
      expect(response.body.messages).toHaveLength(3);
      expect(response.body.messages[0].content).toBe('Hello');
      expect(response.body.messages[1].content).toBe('Hi there!');
      expect(response.body.messages[2].content).toBe('How are you?');
    });

    it('should limit history results', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/chat/history/${sessionId}`)
        .query({ limit: 2 })
        .expect(200);

      expect(response.body.messages).toHaveLength(2);
    });

    it('should return 404 for non-existent conversation', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/chat/history/non-existent-session')
        .expect(404);
    });
  });

  describe('GET /api/v1/chat/conversation/:sessionId', () => {
    let sessionId: string;

    beforeEach(async () => {
      sessionId = `test-session-${Date.now()}`;
      await chatService.createConversation(sessionId, {
        workflowId: 'cf769a32-2140-420f-99ed-19abb22ee721',
        workspaceId: '85fb8ec7-e33c-43ce-bc20-7fa0ac55060b',
        metadata: { source: 'test' },
      });
    });

    afterEach(async () => {
      await chatService.deleteConversation(sessionId);
    });

    it('should retrieve conversation details', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/chat/conversation/${sessionId}`)
        .expect(200);

      expect(response.body.sessionId).toBe(sessionId);
      expect(response.body.workflowId).toBe('cf769a32-2140-420f-99ed-19abb22ee721');
      expect(response.body.status).toBe('active');
      expect(response.body.metadata).toEqual({ source: 'test' });
    });

    it('should return 404 for non-existent conversation', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/chat/conversation/non-existent-session')
        .expect(404);
    });
  });

  describe('End-to-End Chat Flow', () => {
    it('should complete full conversation flow with context', async () => {
      const sessionId = `e2e-session-${Date.now()}`;

      // Step 1: Start conversation
      const startResponse = await request(app.getHttpServer())
        .post('/api/v1/chat/start')
        .send({
          sessionId,
          workflowId: 'cf769a32-2140-420f-99ed-19abb22ee721',
          workspaceId: '85fb8ec7-e33c-43ce-bc20-7fa0ac55060b',
          initialContext: {
            systemPrompt: 'You are a customer service agent',
            systemMessage: 'How can I help you today?',
          },
        })
        .expect(201);

      expect(startResponse.body.status).toBe('active');

      // Step 2: Send first message
      await request(app.getHttpServer())
        .post('/api/v1/chat/message')
        .send({
          sessionId,
          text: 'I need help with my order',
        })
        .expect(200);

      // Step 3: Send second message
      await request(app.getHttpServer())
        .post('/api/v1/chat/message')
        .send({
          sessionId,
          text: 'Order number is 12345',
        })
        .expect(200);

      // Step 4: Verify history contains both messages
      const historyResponse = await request(app.getHttpServer())
        .get(`/api/v1/chat/history/${sessionId}`)
        .expect(200);

      expect(historyResponse.body.messages).toHaveLength(2);
      expect(historyResponse.body.messages[0].content).toBe('I need help with my order');
      expect(historyResponse.body.messages[1].content).toBe('Order number is 12345');

      // Step 5: Verify context is passed to webhook
      const lastCall = (messageQueueService.sendMessageToWorkflow as jest.Mock).mock.calls.slice(-1)[0];
      const context = lastCall[3]; // 4th argument is context

      expect(context.systemPrompt).toBe('You are a customer service agent');
      expect(context.conversationHistory).toHaveLength(2);
      expect(context.conversationHistory[0].content).toBe('I need help with my order');

      // Cleanup
      await chatService.deleteConversation(sessionId);
    });
  });
});
