import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsObject } from 'class-validator';

export class LogEntryDto {
  @ApiProperty({ description: 'The message to log' })
  @IsString()
  message: string;

  @ApiProperty({ 
    description: 'The log level', 
    enum: ['info', 'warning', 'error', 'debug'],
    default: 'info'
  })
  @IsEnum(['info', 'warning', 'error', 'debug'])
  @IsOptional()
  level?: 'info' | 'warning' | 'error' | 'debug';

  @ApiPropertyOptional({ description: 'Additional metadata for the log entry' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
} 