import { IsString, IsUUID, IsOptional, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Initial context for conversation
 */
export class InitialContextDto {
  @ApiPropertyOptional({
    description: 'System prompt for the AI agent',
    example: 'You are a helpful customer service assistant.',
  })
  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @ApiPropertyOptional({
    description: 'Initial system message',
    example: 'Welcome! How can I help you today?',
  })
  @IsOptional()
  @IsString()
  systemMessage?: string;
}

/**
 * DTO for starting a new conversation
 */
export class StartConversationDto {
  @ApiProperty({
    description: 'Unique session identifier',
    example: 'session_123abc',
  })
  @IsString()
  sessionId: string;

  @ApiProperty({
    description: 'Workflow ID to handle the conversation',
    example: 'cf769a32-2140-420f-99ed-19abb22ee721',
  })
  @IsUUID()
  workflowId: string;

  @ApiProperty({
    description: 'Workspace ID',
    example: '85fb8ec7-e33c-43ce-bc20-7fa0ac55060b',
  })
  @IsUUID()
  workspaceId: string;

  @ApiPropertyOptional({
    description: 'User ID (optional)',
    example: 'user_456def',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Initial context for the conversation',
    type: InitialContextDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => InitialContextDto)
  initialContext?: InitialContextDto;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { source: 'web', language: 'en' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
