import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsObject, ValidateIf } from 'class-validator';
import { AgentNodeType } from '@prisma/client';
export class CreateChatDto {
  @ApiProperty({ description: 'The ID of the assistant to chat with (required unless agentId is provided)' })
  @IsString()
  @ValidateIf((o) => !o.agentId)
  assistantId?: string;

  @ApiPropertyOptional({ description: 'The ID of the agent to associate with the chat' })
  @IsString()
  @IsOptional()
  agentId?: string;

  @ApiPropertyOptional({ description: 'The ID of the workflow to associate with the chat' })
  @IsString()
  @IsOptional()
  workflowId?: string;

  @ApiPropertyOptional({ description: 'The type of node in agent workflow' })
  @IsEnum(AgentNodeType)
  @IsOptional()
  nodeType?: AgentNodeType;

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