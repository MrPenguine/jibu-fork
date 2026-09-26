import { 
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../../../core/database/prisma.service';
import { ChatsService } from './chats.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { OrganizationGuard } from '../../../core/auth/guards/organization.guard';
import { ContactService } from '../../../core/contact/contact.service';

/**
 * ChatsController handles REST endpoints for chats, delegating to Prisma for chat rows and ChatsService for message diagnostics.
 */
@ApiTags('chats')
@UseGuards(JwtAuthGuard, OrganizationGuard)
@Controller('v1/chats')
export class ChatsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatsService: ChatsService,
    private readonly contactService: ContactService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List chats for an agent' })
  async listChats(
    @Req() req,
    @Query('agentId') agentId?: string,
    @Query('sessionType') sessionType = 'chat',
  ) {
    const workspaceId =
      req.user?.lastWorkspaceId ||
      req.user?.workspaceId ||
      (req.headers['x-workspace-id'] as string);

    if (!workspaceId) {
      throw new BadRequestException('No workspace selected');
    }

    const where: any = { workspaceId, sessionType };
    if (agentId) {
      where.agentId = agentId;
    }

    return this.prisma.chat.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });
  }

  @Post()
  @ApiOperation({ summary: 'Create a new chat session' })
  async createChat(@Req() req, @Body() dto: CreateChatDto) {
    const workspaceId =
      req.user?.lastWorkspaceId ||
      req.user?.workspaceId ||
      (req.headers['x-workspace-id'] as string);

    if (!workspaceId) {
      throw new BadRequestException('No workspace selected');
    }

    const sessionId = dto.sessionId || `session-${Date.now()}`;
    const sessionType = dto.sessionType || 'chat';

    // Additive: only the new workspace test-chat picker (chats/page.tsx)
    // sends contactExternalId — existing callers like FloatingAgentTester
    // are unaffected and keep creating contact-less chats.
    let contactId: string | undefined;
    if (dto.contactExternalId) {
      const contact = await this.contactService.resolve(workspaceId, dto.contactExternalId, dto.channel || 'phone');
      contactId = contact?.id;
    }

    const chat = await this.prisma.chat.create({
      data: {
        name: dto.name,
        workspaceId,
        agentId: dto.agentId,
        sessionId,
        sessionType,
        metadata: dto.metadata,
        contactId,
      },
    });

    return chat;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single chat (for polling status/lifecycle)' })
  async getChat(@Param('id') chatId: string, @Req() req) {
    const workspaceId =
      req.user?.lastWorkspaceId ||
      req.user?.workspaceId ||
      (req.headers['x-workspace-id'] as string);

    if (!workspaceId) {
      throw new BadRequestException('No workspace selected');
    }

    const chat = await this.prisma.chat.findFirst({
      where: { workspaceId, OR: [{ id: chatId }, { sessionId: chatId }] },
    });
    if (!chat) {
      throw new BadRequestException('Chat not found');
    }
    return chat;
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Get diagnostic messages for a chat' })
  async getChatMessages(@Param('id') chatId: string, @Req() req) {
    const workspaceId =
      req.user?.lastWorkspaceId ||
      req.user?.workspaceId ||
      (req.headers['x-workspace-id'] as string);

    if (!workspaceId) {
      throw new BadRequestException('No workspace selected');
    }

    return this.chatsService.getChatMessages(chatId, workspaceId);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Create a diagnostic message and enqueue webhook job' })
  async createMessage(
    @Param('id') chatId: string,
    @Req() req,
    @Body() dto: CreateMessageDto,
  ) {
    const workspaceId =
      req.user?.lastWorkspaceId ||
      req.user?.workspaceId ||
      (req.headers['x-workspace-id'] as string);

    if (!workspaceId) {
      throw new BadRequestException('No workspace selected');
    }

    return this.chatsService.createMessage(chatId, dto, workspaceId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update chat name' })
  async updateChat(
    @Param('id') chatId: string,
    @Req() req,
    @Body('name') name: string,
  ) {
    const workspaceId =
      req.user?.lastWorkspaceId ||
      req.user?.workspaceId ||
      (req.headers['x-workspace-id'] as string);

    if (!workspaceId) {
      throw new BadRequestException('No workspace selected');
    }

    return this.prisma.chat.update({
      where: { id: chatId },
      data: { name },
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a chat' })
  async deleteChat(@Param('id') chatId: string, @Req() req) {
    const workspaceId =
      req.user?.lastWorkspaceId ||
      req.user?.workspaceId ||
      (req.headers['x-workspace-id'] as string);

    if (!workspaceId) {
      throw new BadRequestException('No workspace selected');
    }

    await this.prisma.chat.delete({ where: { id: chatId } });
    return { success: true };
  }
}