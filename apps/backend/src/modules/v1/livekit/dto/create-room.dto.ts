import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateRoomDto {
  @ApiProperty({
    description: 'Name of the room to create',
    example: 'agent-voice-session-123',
  })
  @IsString()
  roomName: string;

  @ApiProperty({
    description: 'Optional metadata for the room',
    example: '{"agentId": "agent-123", "userId": "user-456"}',
    required: false,
  })
  @IsString()
  @IsOptional()
  metadata?: string;

  @ApiProperty({
    description: 'Whether the room should be empty on creation',
    example: true,
    required: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  emptyOnCreate?: boolean;
}
