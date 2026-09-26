import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject, IsEnum, ValidateIf } from 'class-validator';
export class CreateChatDto {
  @ApiProperty({ description: 'The ID of the assistant to chat with (required unless agentId is provided)' })
  @IsString()
  @ValidateIf((o) => !o.agentId)
  assistantId?: string;

  @ApiPropertyOptional({ description: 'The ID of the agent to associate with the chat' })
  @IsString()
  @IsOptional()
  agentId?: string;

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

  @ApiPropertyOptional({
    description:
      'Phone number or other external identity to resolve into a Contact for this chat (e.g. the workspace test-chat picker). Additive — omitted by existing callers like the agent config tester.',
  })
  @IsString()
  @IsOptional()
  contactExternalId?: string;

  @ApiPropertyOptional({ description: 'Channel for contactExternalId resolution', enum: ['phone', 'whatsapp', 'widget'] })
  @IsEnum(['phone', 'whatsapp', 'widget'])
  @IsOptional()
  channel?: 'phone' | 'whatsapp' | 'widget';
}