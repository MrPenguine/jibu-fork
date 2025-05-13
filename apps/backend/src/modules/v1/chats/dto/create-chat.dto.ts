import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsObject } from 'class-validator';

export class CreateChatDto {
  @ApiProperty({ description: 'The ID of the assistant to chat with' })
  @IsString()
  assistantId: string;

  @ApiPropertyOptional({ description: 'A name for the chat' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Session ID to use for the chat (e.g., user ID or phone number)' })
  @IsString()
  @IsOptional()
  sessionId?: string;

  @ApiPropertyOptional({ description: 'Type of session: "chat" or "call"' })
  @IsEnum(['chat', 'call'])
  @IsOptional()
  sessionType?: 'chat' | 'call';

  @ApiPropertyOptional({ description: 'Additional metadata for the chat' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
} 