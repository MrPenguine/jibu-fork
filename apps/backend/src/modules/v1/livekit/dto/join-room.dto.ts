import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class JoinRoomDto {
  @ApiProperty({
    description: 'Unique identity of the participant',
    example: 'user-123',
  })
  @IsString()
  identity: string;

  @ApiProperty({
    description: 'Name of the room to join',
    example: 'agent-voice-session-123',
  })
  @IsString()
  roomName: string;

  @ApiProperty({
    description: 'Optional metadata for the participant',
    example: '{"name": "John Doe", "role": "user"}',
    required: false,
  })
  @IsString()
  @IsOptional()
  metadata?: string;
}
