import { IsString, IsOptional, IsArray, IsBoolean, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class AgentChannelsDto {
  @IsBoolean()
  @IsOptional()
  chat?: boolean;

  @IsBoolean()
  @IsOptional()
  whatsapp?: boolean;

  @IsBoolean()
  @IsOptional()
  voice?: boolean;
}

/**
 * Config-form payload: the single source of truth for an agent's runtime
 * behavior (prompt + provider/model + KBs + tools + voice + channels).
 */
export class UpdateAgentConfigDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  systemPrompt?: string;

  @IsString()
  @IsOptional()
  provider?: string;

  @IsString()
  @IsOptional()
  model?: string;

  @IsNumber()
  @IsOptional()
  temperature?: number;

  @IsNumber()
  @IsOptional()
  maxTokens?: number;

  // Voice settings (only relevant when the voice channel is enabled)
  @IsString()
  @IsOptional()
  ttsProvider?: string;

  @IsString()
  @IsOptional()
  ttsVoiceId?: string;

  @IsString()
  @IsOptional()
  sttProvider?: string;

  @IsString()
  @IsOptional()
  firstMessage?: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  knowledgeBaseIds?: string[];

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  toolIds?: string[];

  @ValidateNested()
  @Type(() => AgentChannelsDto)
  @IsOptional()
  channels?: AgentChannelsDto;
}
