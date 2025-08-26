import { IsOptional, IsString, IsBoolean, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateWorkflowDto {
  @ApiProperty({
    description: 'Name of the workflow',
    example: 'Customer Support Workflow',
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'Description of the workflow',
    example: 'A workflow for handling customer support queries',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'ID of the associated n8n workflow',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsString()
  @IsOptional()
  n8nWorkflowId?: string;

  @ApiProperty({
    description: 'Workspace ID that the workflow belongs to',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  workspaceId?: string;

  @ApiProperty({
    description: 'Agent ID associated with this workflow (alias: assistantId on frontend)',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  agentId?: string;

  @ApiProperty({
    description: 'Unified workflow JSON blob containing ui, graph (nodes/edges), metadata, etc.',
    required: false,
  })
  @IsOptional()
  workflowJson?: any;

  @ApiProperty({
    description: 'Publish state hint (publish via dedicated endpoint; accepted but not used here)',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;
}
