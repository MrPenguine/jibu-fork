import { IsString, IsNotEmpty, IsOptional, IsArray, IsBoolean } from 'class-validator';

export class CreateIntentDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  promptSnippet?: string;

  // null/omitted = workspace-level reusable template, not agent-specific
  @IsOptional()
  @IsString()
  agentId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  toolIds?: string[];
}

export class UpdateIntentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  promptSnippet?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  toolIds?: string[];
}
