import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsArray, IsObject, IsIn } from 'class-validator';

// Phase 1 of the tooling plan: generic, client-configurable tool types only.
// google.calendar.* stays a valid `Tool.type` value elsewhere in the system
// (already executed by tool-executor.service.ts) but isn't offered from this
// creation UI yet — see the plan's "generic first" decision.
export const CREATABLE_TOOL_TYPES = ['http.get', 'http.post', 'n8n.webhook'] as const;
export type CreatableToolType = (typeof CREATABLE_TOOL_TYPES)[number];

export class CreateToolDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(CREATABLE_TOOL_TYPES)
  type: CreatableToolType;

  // JSON-Schema-shaped function definition the LLM sees: { name, description, parameters }
  @IsObject()
  function: Record<string, unknown>;

  // Type-specific config: HTTP -> { url, method, headers, bodyTemplate };
  // n8n -> { workflowId, webhookUrl } (manual for now — see plan's n8n future-direction note)
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  credentialId?: string;

  @IsOptional()
  @IsBoolean()
  requiresConfirmation?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredSlots?: string[];
}
