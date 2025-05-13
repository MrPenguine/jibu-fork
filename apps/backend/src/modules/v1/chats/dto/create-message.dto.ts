import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsNumber, IsObject } from 'class-validator';

export class CreateMessageDto {
  @ApiProperty({ description: 'The message content' })
  @IsString()
  content: string;

  @ApiProperty({ description: 'The role of the message sender', enum: ['user', 'assistant', 'system'] })
  @IsEnum(['user', 'assistant', 'system'])
  role: 'user' | 'assistant' | 'system';

  @ApiProperty({ description: 'The order of the message in the conversation' })
  @IsNumber()
  sequenceId: number;

  @ApiPropertyOptional({ description: 'The type of message', enum: ['text', 'audio', 'transcript'], default: 'text' })
  @IsEnum(['text', 'audio', 'transcript'])
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({ description: 'Additional metadata for the message' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
} 