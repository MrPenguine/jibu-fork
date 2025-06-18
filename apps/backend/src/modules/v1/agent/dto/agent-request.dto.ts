import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject, IsEnum, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class AgentConfigDto {
  @ApiPropertyOptional({ description: 'ID of the assistant to use' })
  @IsString()
  @IsOptional()
  assistantId?: string;

  @ApiPropertyOptional({ description: 'ID of the client/user' })
  @IsString()
  @IsOptional()
  clientId?: string;

  @ApiPropertyOptional({ description: 'ID of the knowledge base to query' })
  @IsString()
  @IsOptional()
  knowledgeBaseId?: string;

  @ApiPropertyOptional({ description: 'Whether to stream the response' })
  @IsOptional()
  stream?: boolean;
}

export class AgentRequestDto {
  @ApiProperty({ description: 'The input query to process' })
  @IsString()
  input: string;

  @ApiPropertyOptional({ description: 'The type of input', enum: ['chat', 'text'], default: 'chat' })
  @IsEnum(['chat', 'text'])
  @IsOptional()
  inputType?: 'chat' | 'text';

  @ApiPropertyOptional({ description: 'The type of output', enum: ['chat', 'text'], default: 'chat' })
  @IsEnum(['chat', 'text'])
  @IsOptional()
  outputType?: 'chat' | 'text';

  @ApiPropertyOptional({ description: 'Session ID for conversation tracking' })
  @IsString()
  @IsOptional()
  sessionId?: string;

  @ApiProperty({ description: 'Configuration for the agent' })
  @IsObject()
  @ValidateNested()
  @Type(() => AgentConfigDto)
  config: AgentConfigDto;
}
