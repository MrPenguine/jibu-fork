import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req, BadRequestException, NotFoundException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { WorkspaceMemberGuard } from '../../../core/auth/guards/workspace-member.guard';
import { AssistantService } from './assistant.service';
import { CreateAssistantDto } from './dto/create-assistant.dto';
import { UpdateAssistantDto } from './dto/update-assistant.dto';

@ApiTags('assistants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
@Controller('assistants')
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Get()
  @ApiOperation({ summary: 'List assistants scoped by workspace and optionally by agent' })
  @ApiResponse({ status: 200 })
  async findAll(@Req() req, @Query('workspaceId') workspaceId?: string, @Query('agentId') agentId?: string) {
    const wsId = workspaceId || req.user?.lastWorkspaceId;
    if (!wsId) throw new BadRequestException('Workspace ID must be provided.');
    return this.assistantService.findAll(wsId, agentId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an assistant by ID (scoped to workspace)' })
  @ApiResponse({ status: 200 })
  async findOne(@Param('id') id: string, @Req() req) {
    const wsId = req.user?.lastWorkspaceId;
    if (!wsId) throw new BadRequestException('No workspace selected');
    const assistant = await this.assistantService.findOne(id, wsId);
    if (!assistant) throw new NotFoundException('Assistant not found');
    return assistant;
  }

  @Post()
  @ApiOperation({ summary: 'Create an assistant linked to an agent and workspace' })
  @ApiResponse({ status: 201 })
  async create(@Body() dto: CreateAssistantDto, @Req() req) {
    const wsId = dto.workspaceId || req.user?.lastWorkspaceId;
    if (!wsId) throw new BadRequestException('Workspace ID is required');
    if (!dto.agentId) throw new BadRequestException('agentId is required');
    return this.assistantService.create({ ...dto, workspaceId: wsId });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an assistant (workspace scoped)' })
  @ApiResponse({ status: 200 })
  async update(@Param('id') id: string, @Body() dto: UpdateAssistantDto, @Req() req) {
    const wsId = req.user?.lastWorkspaceId;
    if (!wsId) throw new BadRequestException('No workspace selected');
    return this.assistantService.update(id, wsId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an assistant (workspace scoped)' })
  @ApiResponse({ status: 200 })
  async remove(@Param('id') id: string, @Req() req) {
    const wsId = req.query?.workspaceId || req.user?.lastWorkspaceId;
    if (!wsId) throw new BadRequestException('Workspace ID must be provided to delete an assistant.');
    return this.assistantService.remove(id, wsId);
  }
}
