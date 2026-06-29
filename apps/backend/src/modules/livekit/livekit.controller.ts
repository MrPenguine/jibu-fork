import { Controller, Get, Post, Delete, Query, Param, Body, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LiveKitService } from './livekit.service';
import { LiveKitAgentService } from './livekit-agent.service';
import { CallConcurrencyService } from './call-concurrency.service';
import { Public } from '../../core/auth/decorators/public.decorator';

@ApiTags('livekit')
@Controller('livekit')
export class LiveKitController {
  constructor(
    private readonly livekitService: LiveKitService,
    private readonly livekitAgentService: LiveKitAgentService,
    private readonly concurrency: CallConcurrencyService,
  ) {}

  @Public()
  @Get('token')
  async getToken(@Query('room') room: string, @Query('user') user: string) {
    return { token: await this.livekitService.createToken(user, room) };
  }

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'LiveKit configuration/health probe' })
  health() {
    return this.livekitService.health();
  }

  @Public()
  @Get('voice/start')
  @ApiOperation({ summary: 'Start a voice room for an agent and mint a caller token' })
  async startVoice(@Query('agentId') agentId: string, @Query('sessionId') sessionId?: string) {
    if (!agentId) throw new BadRequestException('agentId is required');
    // Resolves agent + workspace (throws NotFound if the agent does not exist).
    const config = await this.livekitAgentService.getAgentConfig(agentId);
    const session = await this.livekitService.startVoiceSession({
      agentId,
      workspaceId: config.workspaceId,
      sessionId: sessionId || randomUUID(),
    });
    return { ...session, agent: { id: config.agentId, name: config.name } };
  }

  @Public()
  @Post('voice/end')
  @ApiOperation({ summary: 'End a voice room (delete it on the LiveKit server)' })
  async endVoice(@Body() body: { room: string }) {
    if (!body?.room) throw new BadRequestException('room is required');
    return this.livekitService.deleteRoom(body.room);
  }

  @Public()
  @Get('rooms')
  @ApiOperation({ summary: 'List active LiveKit rooms' })
  async rooms() {
    return { rooms: await this.livekitService.listRooms() };
  }

  @Public()
  @Get('rooms/:room/participants')
  @ApiOperation({ summary: 'List participants in a room' })
  async participants(@Param('room') room: string) {
    return { participants: await this.livekitService.listParticipants(room) };
  }

  @Public()
  @Get('agent-config')
  @ApiOperation({ summary: 'Get an agent config for the LiveKit voice worker' })
  async getAgentConfig(@Query('agentId') agentId: string) {
    if (!agentId) throw new BadRequestException('agentId is required');
    return this.livekitAgentService.getAgentConfig(agentId);
  }

  @Public()
  @Post('execute-tool')
  @ApiOperation({ summary: 'Execute a single tool requested by the voice agent LLM' })
  async executeTool(
    @Body() body: { toolId: string; arguments?: Record<string, unknown>; workspaceId: string },
  ) {
    if (!body?.toolId || !body?.workspaceId) {
      throw new BadRequestException('toolId and workspaceId are required');
    }
    return this.livekitAgentService.executeTool(body.toolId, body.arguments || {}, body.workspaceId);
  }

  @Public()
  @Get('active-calls')
  @ApiOperation({ summary: 'List active voice calls for a workspace' })
  async activeCalls(@Query('workspaceId') workspaceId: string) {
    if (!workspaceId) throw new BadRequestException('workspaceId is required');
    const calls = await this.concurrency.listActiveCalls(workspaceId);
    const limit = await this.concurrency.getLimit(workspaceId);
    return { calls, count: calls.length, limit };
  }

  @Public()
  @Post('calls/acquire')
  @ApiOperation({ summary: 'Reserve a concurrency slot for a new voice call' })
  async acquire(
    @Body()
    body: { workspaceId: string; connectionId: string; agentId?: string; sessionId?: string; room?: string },
  ) {
    if (!body?.workspaceId || !body?.connectionId) {
      throw new BadRequestException('workspaceId and connectionId are required');
    }
    return this.concurrency.tryAcquire(body.workspaceId, {
      connectionId: body.connectionId,
      agentId: body.agentId,
      sessionId: body.sessionId,
      room: body.room,
    });
  }

  @Public()
  @Post('calls/heartbeat')
  async heartbeat(@Body() body: { workspaceId: string; connectionId: string }) {
    await this.concurrency.heartbeat(body.workspaceId, body.connectionId);
    return { ok: true };
  }

  @Public()
  @Post('calls/release')
  async release(@Body() body: { workspaceId: string; connectionId: string }) {
    await this.concurrency.release(body.workspaceId, body.connectionId);
    return { ok: true };
  }

  @Public()
  @Post('dispatch')
  @ApiOperation({ summary: 'Inbound SIP dispatch: resolve agent for a dialed number (scaffold)' })
  async dispatch(@Body() body: { dialedNumber: string; room?: string }) {
    if (!body?.dialedNumber) throw new BadRequestException('dialedNumber is required');
    const resolved = await this.livekitAgentService.resolveAgentForNumber(body.dialedNumber);
    if (!resolved) return { matched: false };
    // Room metadata that the Python agent reads on join.
    return {
      matched: true,
      metadata: { agent_id: resolved.agentId, workspace_id: resolved.workspaceId },
    };
  }
}
