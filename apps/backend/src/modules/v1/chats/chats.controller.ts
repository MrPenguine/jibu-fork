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
  Patch
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

@ApiTags('chats')
@Controller('v1/chats')
@UseGuards(AuthGuard('jwt'), OrgRoleGuard)
@ApiBearerAuth()
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}

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
} 