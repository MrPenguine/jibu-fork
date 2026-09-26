import { IsString, IsOptional, IsBoolean, IsArray, IsObject, IsIn } from 'class-validator';
import { CREATABLE_TOOL_TYPES, CreatableToolType } from './create-tool.dto';

export class UpdateToolDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(CREATABLE_TOOL_TYPES)
  type?: CreatableToolType;

  @IsOptional()
  @IsObject()
  function?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  credentialId?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresConfirmation?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredSlots?: string[];
}
