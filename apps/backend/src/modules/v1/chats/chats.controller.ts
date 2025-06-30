import { 
  Body, 
  Controller, 
  Get, 
  Post, 
  Param, 
  Delete, 
  Query, 
  UseGuards,
  Req,
  Patch,
  Inject
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ChatsService } from './chats.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import { OrgRoleGuard } from '../../../core/auth/guards/org-role.guard';
import { Request } from 'express';
import { Public } from '../../../core/auth/decorators/public.decorator';
import { N8nClient } from '../../../core/n8n-orchestrator/n8n-client';

@ApiTags('chats')
@Controller('v1/chats')
@UseGuards(AuthGuard('jwt'), OrgRoleGuard)
@ApiBearerAuth()
export class ChatsController {
  constructor(
    private readonly chatsService: ChatsService,
    @Inject(N8nClient) private readonly n8nClient: N8nClient
  ) {}

  @Post()
  @Public()
  @ApiOperation({ summary: 'Create a new chat' })
  async createChat(@Body() createChatDto: CreateChatDto, @Req() req: Request) {
    const organizationId = req.headers['x-organization-id'] as string;
    const userId = req.user?.['id'] as string || 'anonymous-user';
    
    return this.chatsService.createChat({
      ...createChatDto,
      organizationId,
      sessionId: createChatDto.sessionId || userId, // Use provided sessionId or fallback to userId
    });
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get chats by assistantId, agentId, or workflowId' })
  @ApiQuery({ name: 'assistantId', required: false })
  @ApiQuery({ name: 'agentId', required: false })
  @ApiQuery({ name: 'workflowId', required: false })
  @ApiQuery({ name: 'sessionType', required: false })
  @ApiQuery({ name: 'sessionId', required: false })
  async getChats(
    @Req() req: Request,
    @Query('assistantId') assistantId?: string,
    @Query('agentId') agentId?: string,
    @Query('workflowId') workflowId?: string,
    @Query('sessionType') sessionType?: string,
    @Query('sessionId') sessionId?: string
  ) {
    const organizationId = req.headers['x-organization-id'] as string;
    
    const filters: { sessionType?: string; sessionId?: string; agentId?: string; workflowId?: string } = {};
    if (sessionType) filters.sessionType = sessionType;
    if (sessionId) filters.sessionId = sessionId;
    
    // Handle multiple possible filter types
    if (assistantId) {
      // Filtering by assistantId
      if (agentId) filters.agentId = agentId;
      if (workflowId) filters.workflowId = workflowId;
      return this.chatsService.getChats(organizationId, assistantId, filters);
    } else if (agentId) {
      // Filtering by agentId
      if (workflowId) filters.workflowId = workflowId;
      return this.chatsService.getChatsByAgentId(organizationId, agentId, filters);
    } else if (workflowId) {
      // Filtering by workflowId
      return this.chatsService.getChatsByWorkflowId(organizationId, workflowId, filters);
    } else {
      // No filter provided
      throw new Error('At least one of assistantId, agentId, or workflowId must be provided');
    }
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get a chat by ID' })
  async getChat(@Param('id') id: string, @Req() req: Request) {
    const organizationId = req.headers['x-organization-id'] as string;
    return this.chatsService.getChat(id, organizationId);
  }

  @Patch(':id')
  @Public()
  @ApiOperation({ summary: 'Update a chat' })
  async updateChat(
    @Param('id') id: string, 
    @Body() updateChatDto: UpdateChatDto,
    @Req() req: Request
  ) {
    const organizationId = req.headers['x-organization-id'] as string;
    return this.chatsService.updateChat(id, updateChatDto, organizationId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a chat' })
  async deleteChat(@Param('id') id: string, @Req() req: Request) {
    const organizationId = req.headers['x-organization-id'] as string;
    return this.chatsService.deleteChat(id, organizationId);
  }

  @Get(':chatId/messages')
  @Public()
  @ApiOperation({ summary: 'Get all messages for a chat' })
  async getChatMessages(@Param('chatId') chatId: string, @Req() req: Request) {
    const organizationId = req.headers['x-organization-id'] as string;
    return this.chatsService.getChatMessages(chatId, organizationId);
  }

  @Post(':chatId/messages')
  @Public()
  @ApiOperation({ summary: 'Create a new message in a chat' })
  async createMessage(
    @Param('chatId') chatId: string, 
    @Body() createMessageDto: CreateMessageDto,
    @Req() req: Request
  ) {
    const organizationId = req.headers['x-organization-id'] as string;
    return this.chatsService.createMessage(chatId, createMessageDto, organizationId);
  }

  @Post('test/n8n-webhook')
  @Public()
  @ApiOperation({ summary: 'Test n8n webhook connection' })
  async testN8nWebhook(@Body() body: { message: string }, @Req() req: Request) {
    const organizationId = req.headers['x-organization-id'] as string || 'test-org';
    const testChatId = 'test-chat-id';
    
    return this.chatsService.createMessage(testChatId, {
      content: body.message || 'Test message for n8n',
      role: 'user',
      sequenceId: 1,
      type: 'text',
      metadata: { isTest: true }
    }, organizationId);
  }

  @Get('test/validate-webhook')
  @Public()
  @ApiOperation({ summary: 'Validate n8n webhook URL configuration' })
  @ApiQuery({ name: 'url', required: false, description: 'Optional webhook URL to validate. If not provided, uses N8N_WEBHOOK_URL from env' })
  async validateN8nWebhook(@Req() req: Request, @Query('url') url?: string) {
    try {
      // Get URL from query param or environment
      const webhookUrl = url || this.n8nClient['configService'].get<string>('N8N_WEBHOOK_URL');
      
      if (!webhookUrl) {
        return {
          success: false,
          message: 'No webhook URL provided and N8N_WEBHOOK_URL not found in environment.',
          validationDetails: null
        };
      }

      // Use the N8nClient to validate the webhook URL
      const validationResult = await this.n8nClient.validateWebhook(webhookUrl);
      
      return {
        success: validationResult.valid,
        message: validationResult.message,
        validationDetails: {
          webhookUrl: webhookUrl.replace(/\/\/.+:.+@/, '//***:***@'), // Mask credentials if present in URL
          status: validationResult.status,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Validation process error: ${error.message}`,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      };
    }
  }
} 