import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsObject } from 'class-validator';

export class UpdateChatDto {
  @ApiPropertyOptional({ description: 'A name for the chat' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Type of session: "chat" or "call"' })
  @IsEnum(['chat', 'call'])
  @IsOptional()
  sessionType?: 'chat' | 'call';

  @ApiPropertyOptional({ description: 'Additional metadata for the chat' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
} 