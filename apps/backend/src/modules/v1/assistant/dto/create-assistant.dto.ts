import { IsBoolean, IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

// Reuse enum values as strings; validation is lenient to allow nulls
export class CreateAssistantDto {
  @IsString()
  name!: string;

  @IsString()
  agentId!: string;

  @IsString()
  @IsOptional()
  workspaceId?: string; // Filled from req if not provided

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  llmProvider?: string; // maps to Prisma enum but accept string here

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
