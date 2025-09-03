import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateAssistantDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  agentId?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  llmProvider?: string;

  @IsString()
  @IsOptional()
  llmModel?: string;

  @IsString()
  @IsOptional()
  voiceId?: string;

  @IsString()
  @IsOptional()
  sttModel?: string;

  @IsBoolean()
  @IsOptional()
  hipaaEnabled?: boolean;

  @IsString()
  @IsOptional()
  systemPrompt?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
