import { Controller, Post, Body, Get, Delete, Param, UseGuards, Req, Query } from '@nestjs/common';
import { LivekitService } from './livekit.service';
import { RoomManagerService } from './services/room-manager.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('livekit')
@Controller('v1/livekit')
export class LivekitController {
  constructor(
    private readonly livekitService: LivekitService,
    private readonly roomManagerService: RoomManagerService
  ) {}

  @Post('token')
  @ApiOperation({ summary: 'Generate a token for joining a LiveKit room' })
  @ApiResponse({ status: 201, description: 'Token generated successfully' })
  generateToken(@Body() joinRoomDto: JoinRoomDto) {
    const { identity, roomName, metadata } = joinRoomDto;
    const token = this.livekitService.generateToken(identity, roomName, metadata);
    
    return {
      token,
      url: this.livekitService.getLiveKitUrl(),
    };
  }

  @Get('health')
  @ApiOperation({ summary: 'Check LiveKit service health' })
  @ApiResponse({ status: 200, description: 'LiveKit service health status' })
  checkHealth() {
    const isConfigured = this.livekitService.isConfigured();
    
    return {
      status: isConfigured ? 'healthy' : 'misconfigured',
      configured: isConfigured,
      serverUrl: this.livekitService.getLiveKitUrl(),
    };
  }

  @Get('rooms')
  @ApiOperation({ summary: 'List all active LiveKit rooms' })
  @ApiResponse({ status: 200, description: 'List of rooms returned successfully' })
  async listRooms() {
    return this.roomManagerService.listRooms();
  }

  @Post('rooms')
  @ApiOperation({ summary: 'Create a new LiveKit room' })
  @ApiResponse({ status: 201, description: 'Room created successfully' })
  async createRoom(@Body() createRoomDto: CreateRoomDto) {
    const { roomName, metadata, emptyOnCreate } = createRoomDto;
    return this.roomManagerService.createOrGetRoom(roomName, metadata, emptyOnCreate);
  }

  @Delete('rooms/:roomName')
  @ApiOperation({ summary: 'Delete a LiveKit room' })
  @ApiResponse({ status: 200, description: 'Room deleted successfully' })
  async deleteRoom(@Param('roomName') roomName: string) {
    return this.roomManagerService.deleteRoom(roomName);
  }

  @Get('rooms/:roomName/participants')
  @ApiOperation({ summary: 'List participants in a LiveKit room' })
  @ApiResponse({ status: 200, description: 'List of participants returned successfully' })
  async listParticipants(@Param('roomName') roomName: string) {
    return this.roomManagerService.listParticipants(roomName);
  }
}
